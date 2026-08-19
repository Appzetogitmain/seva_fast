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
            .populate("seller", "name shopName")
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

        return handleResponse(res, 200, "Order status updated", order);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
