import PhotoOrder from "../models/photoOrder.js";
import Seller from "../models/seller.js";
import handleResponse from "../utils/helper.js";
import { getIO } from "../socket/socketManager.js";

/* ===============================
   CUSTOMER: GET SELLERS BY CITY
 ================================ */
export const getSellersByCity = async (req, res) => {
    try {
        const { city } = req.query;
        let query = { acceptsPhotoOrders: true };
        
        if (city) {
            const cityRegex = new RegExp(city, 'i');
            query.$or = [
                { city: cityRegex },
                { address: cityRegex }
            ];
        }

        const sellers = await Seller.find(query)
            .select("name shopName city _id")
            .limit(50);
            
        return handleResponse(res, 200, "Sellers fetched successfully", sellers);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   CUSTOMER: CREATE PHOTO ORDER
 ================================ */
export const createPhotoOrder = async (req, res) => {
    try {
        const { sellerId, photoUrl, notes, city } = req.body;
        const customerId = req.user.id;

        if (!sellerId) {
            return handleResponse(res, 400, "Seller ID is required");
        }

        if (!photoUrl && !notes) {
            return handleResponse(res, 400, "Either a Photo or Notes/Enquiry must be provided");
        }

        const photoOrder = await PhotoOrder.create({
            customer: customerId,
            seller: sellerId,
            photoUrl,
            notes,
            city
        });

        try {
            const io = getIO();
            io.to(`seller:${sellerId}`).emit("new_photo_order", photoOrder);
        } catch (err) {
            console.error("Socket error on new photo order:", err);
        }

        return handleResponse(res, 201, "Custom photo order sent successfully", photoOrder);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   CUSTOMER: GET MY PHOTO ORDERS
 ================================ */
export const getMyPhotoOrders = async (req, res) => {
    try {
        const orders = await PhotoOrder.find({ customer: req.user.id })
            .populate("seller", "name shopName phone city address")
            .sort({ createdAt: -1 });
        return handleResponse(res, 200, "Fetched photo orders", orders);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   SELLER: GET RECEIVED PHOTO ORDERS
 ================================ */
export const getReceivedPhotoOrders = async (req, res) => {
    try {
        const orders = await PhotoOrder.find({ seller: req.user.id })
            .populate("customer", "name phone email")
            .sort({ createdAt: -1 });
        return handleResponse(res, 200, "Fetched received photo orders", orders);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   SELLER: UPDATE PHOTO ORDER STATUS
 ================================ */
export const updatePhotoOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const order = await PhotoOrder.findOneAndUpdate(
            { _id: id, seller: req.user.id },
            { status },
            { new: true }
        );

        if (!order) return handleResponse(res, 404, "Order not found");

        try {
            const sellerDoc = await Seller.findById(req.user.id).select('name shopName').lean();
            const sellerName = sellerDoc?.shopName || sellerDoc?.name || 'Seller';

            const io = getIO();
            io.to(`customer:${order.customer}`).emit("photo_order_status_update", order);
            io.to(`customer:${order.customer}`).emit("photo_order:status_alert", {
                orderId: order._id,
                status: order.status,
                sellerName: sellerName
            });
        } catch (err) {
            console.error("Socket error on photo order status update:", err);
        }

        return handleResponse(res, 200, "Order status updated", order);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   CHAT: GET MESSAGES
 ================================ */
export const getChatMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role; // 'customer' or 'seller'

        const order = await PhotoOrder.findById(id);
        if (!order) return handleResponse(res, 404, "Order not found");

        // Verify access
        if (role === 'customer' && order.customer.toString() !== userId) {
            return handleResponse(res, 403, "Unauthorized access");
        }
        if (role === 'seller' && order.seller.toString() !== userId) {
            return handleResponse(res, 403, "Unauthorized access");
        }

        return handleResponse(res, 200, "Messages fetched", order.messages || []);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   CHAT: SEND MESSAGE
 ================================ */
export const sendChatMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const role = req.user.role;
        const { text, type, estimatedPrice, sellerContactPhone, imageUrl } = req.body;

        const order = await PhotoOrder.findById(id);
        if (!order) return handleResponse(res, 404, "Order not found");

        // Verify access
        if (role === 'customer' && order.customer.toString() !== userId) {
            return handleResponse(res, 403, "Unauthorized access");
        }
        if (role === 'seller' && order.seller.toString() !== userId) {
            return handleResponse(res, 403, "Unauthorized access");
        }

        // Check if chat is disabled by admin
        if (order.chatDisabled) {
            return handleResponse(res, 403, "Chat has been disabled by an administrator");
        }

        const senderRole = role === 'seller' ? 'seller' : 'customer';

        const newMessage = {
            senderRole,
            senderId: userId,
            text,
            type: type || 'text',
            imageUrl,
            estimatedPrice,
            sellerContactPhone
        };

        order.messages.push(newMessage);

        if (type === 'contact_card' && role === 'seller') {
            order.sellerContactShared = true;
        }
        if (type === 'reply_card' && role === 'seller') {
            order.sellerReply = text;
            order.estimatedPrice = estimatedPrice;
        }

        await order.save();

        const savedMessage = order.messages[order.messages.length - 1];

        try {
            const io = getIO();
            io.to(`photo_chat:${id}`).emit("photo_chat_message", savedMessage);
            
            if (role === 'seller') {
                const sellerDoc = await Seller.findById(userId).select('name shopName').lean();
                const sellerName = sellerDoc?.shopName || sellerDoc?.name || 'Seller';

                // Instant notification to the customer
                io.to(`customer:${order.customer}`).emit("photo_order:new_message", {
                    orderId: order._id,
                    sellerName: sellerName,
                    type: type || 'text',
                    text: text || (type === 'image' ? 'Sent a photo' : type === 'reply_card' ? `Sent a price quote: ₹${estimatedPrice || ''}` : type === 'contact_card' ? 'Shared contact details' : 'New message'),
                    message: savedMessage
                });

                io.to(`customer:${order.customer}`).emit("photo_order_status_update", order);
            } else {
                // Customer sent a message -> notify seller
                io.to(`seller:${order.seller}`).emit("photo_order:new_message", {
                    orderId: order._id,
                    customerName: req.user.name || "Customer",
                    type: type || 'text',
                    text: text || (type === 'image' ? 'Sent a photo' : 'New message'),
                    message: savedMessage
                });
                io.to(`seller:${order.seller}`).emit("photo_order_status_update", order);
            }
        } catch (err) {
            console.error("Socket error emitting chat message:", err);
        }

        return handleResponse(res, 201, "Message sent", savedMessage);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   ADMIN: GET ALL PHOTO ORDERS
 ================================ */
export const getAdminPhotoOrders = async (req, res) => {
    try {
        const { role, assignedZones } = req.user;
        let sellerQuery = {};
        
        // If sub-admin, restrict to sellers in their assigned zones
        if (role === 'sub-admin' && assignedZones && assignedZones.length > 0) {
            sellerQuery = { zoneId: { $in: assignedZones } };
        } else if (role === 'sub-admin') {
            return handleResponse(res, 200, "No zones assigned", []);
        }

        let photoOrderQuery = {};

        // Find allowed sellers first for sub-admin
        if (role === 'sub-admin') {
            const allowedSellers = await Seller.find(sellerQuery).select('_id').lean();
            const allowedSellerIds = allowedSellers.map(s => s._id);
            photoOrderQuery = { seller: { $in: allowedSellerIds } };
        }

        const orders = await PhotoOrder.find(photoOrderQuery)
            .populate("customer", "name phone email")
            .populate("seller", "name shopName phone city address")
            .sort({ createdAt: -1 });
            
        return handleResponse(res, 200, "Fetched photo orders successfully", orders);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   ADMIN: GET PHOTO ORDER CHAT
 ================================ */
export const getAdminPhotoOrderChat = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, assignedZones } = req.user;

        const order = await PhotoOrder.findById(id).populate("seller", "zoneId");
        if (!order) return handleResponse(res, 404, "Order not found");

        // Verify access for sub-admin
        if (role === 'sub-admin') {
            if (!assignedZones || assignedZones.length === 0) {
                return handleResponse(res, 403, "Unauthorized access: No zones assigned");
            }
            if (!order.seller || !assignedZones.includes(order.seller.zoneId?.toString())) {
                return handleResponse(res, 403, "Unauthorized access: Order outside your assigned zone");
            }
        }

        return handleResponse(res, 200, "Messages fetched successfully", order.messages || []);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   ADMIN: TOGGLE PHOTO ORDER CHAT
 ================================ */
export const toggleAdminPhotoOrderChat = async (req, res) => {
    try {
        const { id } = req.params;
        const { chatDisabled, chatDisabledReason } = req.body;
        const { role, assignedZones } = req.user;

        const order = await PhotoOrder.findById(id).populate("seller", "zoneId");
        if (!order) return handleResponse(res, 404, "Order not found");

        // Verify access for sub-admin
        if (role === 'sub-admin') {
            if (!assignedZones || assignedZones.length === 0) {
                return handleResponse(res, 403, "Unauthorized access: No zones assigned");
            }
            if (!order.seller || !assignedZones.includes(order.seller.zoneId?.toString())) {
                return handleResponse(res, 403, "Unauthorized access: Order outside your assigned zone");
            }
        }

        order.chatDisabled = chatDisabled;
        if (chatDisabled) {
            order.chatDisabledReason = chatDisabledReason || "Chat has been disabled by an administrator.";
        } else {
            order.chatDisabledReason = "";
        }

        await order.save();

        try {
            const io = getIO();
            const statusPayload = {
                orderId: order._id,
                chatDisabled: order.chatDisabled,
                chatDisabledReason: order.chatDisabledReason
            };
            
            io.to(`photo_chat:${id}`).emit("photo_chat_status_update", statusPayload);
            io.to(`customer:${order.customer}`).emit("photo_chat_status_update", statusPayload);
            io.to(`seller:${order.seller._id}`).emit("photo_chat_status_update", statusPayload);
        } catch (err) {
            console.error("Socket error emitting chat status update:", err);
        }

        return handleResponse(res, 200, `Chat ${chatDisabled ? 'disabled' : 'enabled'} successfully`, {
            chatDisabled: order.chatDisabled,
            chatDisabledReason: order.chatDisabledReason
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
