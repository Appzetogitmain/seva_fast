import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        products: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
            },
        ],
        // Remembers which variant the customer had selected when a product
        // (with variants) was added to the wishlist, so it can be restored
        // when the item is later moved into the cart.
        variantSelections: [
            {
                _id: false,
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                },
                variantSku: {
                    type: String,
                    default: "",
                },
            },
        ],
    },
    { timestamps: true }
);

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
export default Wishlist;
