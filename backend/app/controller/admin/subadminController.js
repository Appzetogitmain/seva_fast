import Admin from "../../models/admin.js";
import handleResponse from "../../utils/helper.js";
import { ensureSubAdminWallet } from "../../services/finance/commissionSplitsReportService.js";
import { OWNER_TYPE } from "../../constants/finance.js";
import Wallet from "../../models/wallet.js";
import { roundCurrency } from "../../utils/money.js";

export const getSubadmins = async (req, res) => {
  try {
    const subadmins = await Admin.find({ role: "sub-admin" })
      .populate("assignedZones")
      .sort({ name: 1 })
      .lean();

    const withWallets = await Promise.all(
      subadmins.map(async (sa) => {
        let wallet = await Wallet.findOne({
          ownerType: OWNER_TYPE.SUB_ADMIN,
          ownerId: sa._id,
        }).lean();
        if (!wallet) {
          wallet = await ensureSubAdminWallet(sa._id);
          wallet = wallet.toObject ? wallet.toObject() : wallet;
        }
        return {
          ...sa,
          wallet: {
            availableBalance: roundCurrency(wallet?.availableBalance || 0),
            pendingBalance: roundCurrency(wallet?.pendingBalance || 0),
            totalCredited: roundCurrency(wallet?.totalCredited || 0),
          },
        };
      }),
    );

    return handleResponse(res, 200, "Sub-admins retrieved successfully", {
      subadmins: withWallets,
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const createSubadmin = async (req, res) => {
  try {
    const { name, email, password, phone, assignedZones, allowedPermissions } = req.body;
    if (!name || !email || !password) {
      return handleResponse(res, 400, "Name, email and password are required");
    }
    // Bug 254: Name must contain only alphabets and spaces
    if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      return handleResponse(res, 400, "Full name must contain only alphabets and spaces");
    }

    const existing = await Admin.findOne({ email });
    if (existing) {
      return handleResponse(res, 409, "User with this email already exists");
    }

    const subadmin = await Admin.create({
      name,
      email,
      password,
      phone,
      role: "sub-admin",
      assignedZones: assignedZones || [],
      allowedPermissions: allowedPermissions || [],
      isVerified: true,
    });

    // Create dedicated commission wallet for this panel sub-admin
    const wallet = await ensureSubAdminWallet(subadmin._id);

    const sanitized = subadmin.toObject();
    delete sanitized.password;
    sanitized.wallet = {
      availableBalance: roundCurrency(wallet.availableBalance || 0),
      pendingBalance: roundCurrency(wallet.pendingBalance || 0),
      totalCredited: roundCurrency(wallet.totalCredited || 0),
    };

    return handleResponse(res, 201, "Sub-admin created successfully", { subadmin: sanitized });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateSubadmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, phone, assignedZones, allowedPermissions } = req.body;

    const subadmin = await Admin.findById(id);
    if (!subadmin || subadmin.role !== "sub-admin") {
      return handleResponse(res, 404, "Sub-admin not found");
    }

    if (email && email !== subadmin.email) {
      const existing = await Admin.findOne({ email });
      if (existing) {
        return handleResponse(res, 409, "User with this email already exists");
      }
      subadmin.email = email;
    }

    if (name) {
      // Bug 254: Name must contain only alphabets and spaces
      if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
        return handleResponse(res, 400, "Full name must contain only alphabets and spaces");
      }
      subadmin.name = name;
    }
    if (phone) subadmin.phone = phone;
    if (assignedZones) subadmin.assignedZones = assignedZones;
    if (allowedPermissions) subadmin.allowedPermissions = allowedPermissions;
    if (password) subadmin.password = password;

    await subadmin.save();
    await ensureSubAdminWallet(subadmin._id);

    const sanitized = subadmin.toObject();
    delete sanitized.password;

    return handleResponse(res, 200, "Sub-admin updated successfully", { subadmin: sanitized });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const deleteSubadmin = async (req, res) => {
  try {
    const { id } = req.params;
    const subadmin = await Admin.findOneAndDelete({ _id: id, role: "sub-admin" });
    if (!subadmin) {
      return handleResponse(res, 404, "Sub-admin not found");
    }
    return handleResponse(res, 200, "Sub-admin deleted successfully");
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getSubadminWalletController = async (req, res) => {
  try {
    const { id } = req.params;
    const subadmin = await Admin.findOne({ _id: id, role: "sub-admin" })
      .select("name email phone assignedZones")
      .populate("assignedZones", "name")
      .lean();
    if (!subadmin) {
      return handleResponse(res, 404, "Sub-admin not found");
    }

    const wallet = await ensureSubAdminWallet(id);
    const Transaction = (await import("../../models/transaction.js")).default;
    const transactions = await Transaction.find({
      user: id,
      userModel: "Admin",
      type: "Commission",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return handleResponse(res, 200, "Sub-admin wallet fetched", {
      subadmin,
      wallet: {
        availableBalance: roundCurrency(wallet.availableBalance || 0),
        pendingBalance: roundCurrency(wallet.pendingBalance || 0),
        totalCredited: roundCurrency(wallet.totalCredited || 0),
        totalDebited: roundCurrency(wallet.totalDebited || 0),
      },
      transactions: transactions.map((t) => ({
        id: t._id,
        amount: t.amount,
        reference: t.reference,
        status: t.status,
        date: t.createdAt,
        description: t.meta?.description || "Commission",
      })),
    });
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
