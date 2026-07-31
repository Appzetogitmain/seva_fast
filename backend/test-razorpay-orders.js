import Razorpay from "razorpay";
async function run() {
    try {
        const rzp = new Razorpay({
            key_id: 'rzp_test_S2tOuYBZiOuLb4',
            key_secret: 'tiR3NbQKSBa5mrdKyZbsnh7x'
        });
        const order = await rzp.orders.create({
            amount: 100,
            currency: "INR",
            receipt: "test_receipt"
        });
        console.log("Success:", order);
    } catch (error) {
        console.error("Error:", error);
    }
}
run();
