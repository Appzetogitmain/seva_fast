import Razorpay from "razorpay";
try {
    const rzp = new Razorpay({
        key_id: 'rzp_test_S2tOuYBZiOuLb4',
        key_secret: 'tiR3NbQKSBa5mrdKyZbsnh7x'
    });
    console.log("Success");
} catch (error) {
    console.error("Error:", error);
}
