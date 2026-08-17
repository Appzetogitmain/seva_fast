import Coupon from "../models/coupon.js";
import handleResponse from "../utils/helper.js";
import Order from "../models/order.js";
import {
    computeCouponDiscount,
    countCouponRedemptions,
    getCouponRedemptionCounts,
    resolveUsedCount,
} from "../services/couponUsageService.js";

function sanitizeCouponNumericFields(data) {
    const fieldsMinZero = ["discountValue", "minOrderValue", "maxDiscount", "usageLimit", "minItems", "monthlyVolumeThreshold"];
    for (const key of fieldsMinZero) {
        if (data[key] === undefined || data[key] === null || data[key] === "") continue;
        const num = Number(data[key]);
        if (!Number.isFinite(num) || num < 0) {
            return { _error: `${key} cannot be negative` };
        }
        data[key] = num;
    }
    if (data.perUserLimit !== undefined && data.perUserLimit !== null && data.perUserLimit !== "") {
        const perUser = Number(data.perUserLimit);
        if (!Number.isFinite(perUser) || perUser < 1) {
            return { _error: "perUserLimit must be at least 1" };
        }
        data.perUserLimit = perUser;
    }
    if (data.birthdayValidityDays !== undefined && data.birthdayValidityDays !== null && data.birthdayValidityDays !== "") {
        const validityDays = Number(data.birthdayValidityDays);
        if (!Number.isFinite(validityDays) || validityDays < 1) {
            return { _error: "birthdayValidityDays must be at least 1" };
        }
        data.birthdayValidityDays = validityDays;
    }
    if (data.discountType === "percentage" && Number(data.discountValue) > 100) {
        return { _error: "Percentage discount cannot exceed 100" };
    }
    return data;
}

async function fetchCoupons(req, extraFilter, { populateCustomer = false } = {}) {
    const { status, search } = req.query;
    const query = { ...extraFilter };

    if (status === "active") {
        const now = new Date();
        query.isActive = true;
        query.validFrom = { $lte: now };
        query.validTill = { $gte: now };
    } else if (status === "expired") {
        query.validTill = { $lt: new Date() };
    }

    if (search) {
        const term = search.trim();
        const searchOr = [
            { code: { $regex: term, $options: "i" } },
            { title: { $regex: term, $options: "i" } },
            { description: { $regex: term, $options: "i" } },
        ];
        // Combine with existing filters without wiping status conditions
        query.$and = [...(query.$and || []), { $or: searchOr }];
    }

    let cursor = Coupon.find(query).sort({ createdAt: -1 });
    if (populateCustomer) {
        cursor = cursor.populate("assignedCustomer", "name phone");
    }
    const coupons = await cursor.lean();
    const counts = await getCouponRedemptionCounts(coupons);
    const withUsage = coupons.map((coupon) => ({
        ...coupon,
        usedCount: resolveUsedCount(coupon, counts),
    }));

    // Keep stored usedCount in sync with real checkout redemptions
    await Promise.all(
        withUsage
            .filter((coupon, index) => Number(coupon.usedCount) !== Number(coupons[index].usedCount || 0))
            .map((coupon) =>
                Coupon.updateOne(
                    { _id: coupon._id },
                    { $set: { usedCount: coupon.usedCount } }
                ).catch(() => null)
            )
    );

    return withUsage;
}

// Admin listing — full visibility, including customer-assigned and template coupons.
export const listCoupons = async (req, res) => {
    try {
        const withUsage = await fetchCoupons(req, {}, { populateCustomer: true });
        return handleResponse(res, 200, "Coupons fetched successfully", withUsage);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Customer-facing listing — excludes other customers' assigned coupons and
// the birthday template itself (neither is meant to be publicly browsable;
// an assigned coupon is redeemed by typing the code sent via WhatsApp).
export const listPublicCoupons = async (req, res) => {
    try {
        const withUsage = await fetchCoupons(req, {
            assignedCustomer: null,
            isBirthdayTemplate: { $ne: true },
        });
        return handleResponse(res, 200, "Coupons fetched successfully", withUsage);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// assignedCustomer/dedupeKey are system-managed (set only by the birthday
// coupon issuance service) — never accepted from the admin form.
function stripSystemManagedFields(data) {
    const { assignedCustomer, dedupeKey, ...rest } = data;
    return rest;
}

// Only one coupon can be the active birthday template at a time.
async function enforceSingleBirthdayTemplate(excludeId) {
    const filter = { isBirthdayTemplate: true };
    if (excludeId) filter._id = { $ne: excludeId };
    await Coupon.updateMany(filter, { $set: { isBirthdayTemplate: false } });
}

export const createCoupon = async (req, res) => {
    try {
        const data = sanitizeCouponNumericFields(stripSystemManagedFields({ ...req.body }));
        if (data._error) {
            return handleResponse(res, 400, data._error);
        }
        if (data.isBirthdayTemplate) {
            await enforceSingleBirthdayTemplate(null);
        }
        const coupon = await Coupon.create(data);
        return handleResponse(res, 201, "Coupon created successfully", coupon);
    } catch (error) {
        if (error.code === 11000) {
            return handleResponse(res, 400, "Coupon code already exists");
        }
        return handleResponse(res, 500, error.message);
    }
};

export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const data = sanitizeCouponNumericFields(stripSystemManagedFields({ ...req.body }));
        if (data._error) {
            return handleResponse(res, 400, data._error);
        }
        if (data.isBirthdayTemplate) {
            await enforceSingleBirthdayTemplate(id);
        }
        const coupon = await Coupon.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
        if (!coupon) {
            return handleResponse(res, 404, "Coupon not found");
        }
        return handleResponse(res, 200, "Coupon updated successfully", coupon);
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || id === "undefined" || id === "null") {
            return handleResponse(res, 400, "Valid coupon id is required");
        }
        const coupon = await Coupon.findByIdAndDelete(id);
        if (!coupon) {
            return handleResponse(res, 404, "Coupon not found");
        }
        return handleResponse(res, 200, "Coupon deleted successfully");
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

// Simple validation engine for checkout
export const validateCoupon = async (req, res) => {
    try {
        const { code, cartTotal, items, customerId } = req.body;

        if (!code) {
            return handleResponse(res, 400, "Coupon code is required");
        }

        const now = new Date();
        const coupon = await Coupon.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return handleResponse(res, 404, "Invalid coupon code");
        }

        if (!coupon.isActive || coupon.validFrom > now || coupon.validTill < now) {
            return handleResponse(res, 400, "This coupon is not active");
        }

        if (coupon.isBirthdayTemplate) {
            return handleResponse(res, 400, "Invalid coupon code");
        }

        if (coupon.assignedCustomer && String(coupon.assignedCustomer) !== String(customerId || "")) {
            return handleResponse(res, 400, "This coupon is not valid for your account");
        }

        // Usage limits (overall) — count checkout groups, not raw order rows
        const totalUsed = await countCouponRedemptions({ coupon });
        if (coupon.usageLimit && totalUsed >= coupon.usageLimit) {
            return handleResponse(res, 400, "This coupon has reached its usage limit");
        }

        // Per-user limit & monthly volume
        let userUsageCount = 0;
        let monthlyVolume = 0;
        if (customerId) {
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const userOrders = await Order.find({
                customer: customerId,
                createdAt: { $gte: monthStart, $lte: now },
                status: { $nin: ["cancelled", "declined"] },
            }).lean();

            monthlyVolume = userOrders.reduce(
                (sum, o) => sum + (o.pricing?.total || 0),
                0
            );

            userUsageCount = await countCouponRedemptions({
                coupon,
                customerId,
            });
        }

        if (coupon.perUserLimit && customerId && userUsageCount >= coupon.perUserLimit) {
            return handleResponse(
                res,
                400,
                `You can use this coupon only ${coupon.perUserLimit} time${coupon.perUserLimit > 1 ? "s" : ""}`
            );
        }

        if (!customerId && coupon.perUserLimit) {
            // Soft warning path: still allow preview, but frontend should send customerId when logged in
        }

        if (
            coupon.couponType === "monthly_volume" &&
            coupon.monthlyVolumeThreshold &&
            monthlyVolume < coupon.monthlyVolumeThreshold
        ) {
            return handleResponse(
                res,
                400,
                "This coupon is for high‑volume buyers only"
            );
        }

        // Base conditions
        if (coupon.minOrderValue && cartTotal < coupon.minOrderValue) {
            return handleResponse(
                res,
                400,
                `Minimum order value should be ₹${coupon.minOrderValue}`
            );
        }

        if (coupon.minItems && Array.isArray(items) && items.length < coupon.minItems) {
            return handleResponse(
                res,
                400,
                `Add at least ${coupon.minItems} items to use this coupon`
            );
        }

        // Category based condition
        if (
            coupon.couponType === "category_based" &&
            Array.isArray(coupon.applicableCategories) &&
            coupon.applicableCategories.length > 0
        ) {
            const hasEligibleItem =
                Array.isArray(items) &&
                items.some((i) =>
                    coupon.applicableCategories.some(
                        (cId) =>
                            String(i.categoryId) === String(cId) ||
                            String(i.category?._id) === String(cId)
                    )
                );
            if (!hasEligibleItem) {
                return handleResponse(
                    res,
                    400,
                    "This coupon is valid only on selected categories"
                );
            }
        }

        // Calculate discount (same formula order placement re-verifies against
        // the server-priced cart before it's ever allowed to reduce the total)
        const { discountAmount, freeDelivery } = computeCouponDiscount(coupon, {
            cartTotal,
            itemCount: Array.isArray(items) ? items.length : 0,
            items: Array.isArray(items) ? items : [],
        });

        if (discountAmount <= 0 && !freeDelivery) {
            return handleResponse(
                res,
                400,
                "This coupon does not provide any discount on current cart"
            );
        }

        return handleResponse(res, 200, "Coupon applied", {
            couponId: coupon._id,
            code: coupon.code,
            discountAmount,
            freeDelivery,
            usedCount: totalUsed,
            usageLimit: coupon.usageLimit || null,
            perUserLimit: coupon.perUserLimit || null,
            userUsageCount,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

