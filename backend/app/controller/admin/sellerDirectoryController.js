import handleResponse from "../../utils/helper.js";
import getPagination from "../../utils/pagination.js";
import Seller from "../../models/seller.js";
import {
  getActiveSellersData,
  getSellerLocationsData,
  getSellerOptions,
} from "../../services/admin/sellerDirectoryService.js";

export const getSellerLocations = async (req, res) => {
  try {
    const {
      q = "",
      category = "all",
      city = "all",
      lifecycle = "all",
      mapLimit: rawMapLimit = "500",
      sort = "orders_desc",
    } = req.query;

    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const assignedZones = req.assignedZones || [];

    const data = await getSellerLocationsData({
      q,
      category,
      city,
      lifecycle,
      mapLimit: rawMapLimit,
      sort,
      page,
      limit,
      skip,
      assignedZones,
    });

    return handleResponse(res, 200, "Seller locations fetched successfully", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getActiveSellers = async (req, res) => {
  try {
    const { q = "", category = "all", sort = "recent" } = req.query;
    const { page, limit, skip } = getPagination(req, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const assignedZones = req.assignedZones || [];

    const data = await getActiveSellersData({
      q,
      category,
      sort,
      page,
      limit,
      skip,
      assignedZones,
    });



    return handleResponse(res, 200, "Active sellers fetched successfully", data);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const getSellers = async (req, res) => {
  try {
    const assignedZones = req.assignedZones || [];
    const sellers = await getSellerOptions(assignedZones);
    return handleResponse(res, 200, "Sellers fetched", sellers);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const updateSellerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { commissionModel, oneTimeChargePaid, oneTimeChargeAmount, oneTimeChargeInterval, categoryCommissionOverrides, acceptsPhotoOrders } = req.body;
    
    const updateData = {};
    if (commissionModel !== undefined) updateData.commissionModel = commissionModel;
    if (oneTimeChargePaid !== undefined) updateData.oneTimeChargePaid = oneTimeChargePaid;
    if (oneTimeChargeAmount !== undefined) updateData.oneTimeChargeAmount = Number(oneTimeChargeAmount);
    if (oneTimeChargeInterval !== undefined) updateData.oneTimeChargeInterval = oneTimeChargeInterval;
    if (categoryCommissionOverrides !== undefined) updateData.categoryCommissionOverrides = categoryCommissionOverrides;
    if (acceptsPhotoOrders !== undefined) updateData.acceptsPhotoOrders = acceptsPhotoOrders;

    const seller = await Seller.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }
    
    return handleResponse(res, 200, "Seller details updated successfully", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

export const deleteSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const seller = await Seller.findByIdAndDelete(id);
    
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }
    
    return handleResponse(res, 200, "Seller deleted successfully", seller);
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};
