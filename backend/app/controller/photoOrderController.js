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
        const { text, type, estimatedPrice, sellerContactPhone } = req.body;

        const order = await PhotoOrder.findById(id);
        if (!order) return handleResponse(res, 404, "Order not found");

        // Verify access
        if (role === 'customer' && order.customer.toString() !== userId) {
            return handleResponse(res, 403, "Unauthorized access");
        }
        if (role === 'seller' && order.seller.toString() !== userId) {
            return handleResponse(res, 403, "Unauthorized access");
        }

        const senderRole = role === 'seller' ? 'seller' : 'customer';

        const newMessage = {
            senderRole,
            senderId: userId,
            text,
            type: type || 'text',
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
                    text: text || (type === 'reply_card' ? `Sent a price quote: ₹${estimatedPrice || ''}` : type === 'contact_card' ? 'Shared contact details' : 'New message'),
                    message: savedMessage
                });

                io.to(`customer:${order.customer}`).emit("photo_order_status_update", order);
            } else {
                // Customer sent a message -> notify seller
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
