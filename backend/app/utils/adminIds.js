import Admin from "../models/admin.js";

export async function getAdminIds() {
  const admins = await Admin.find().select("_id").lean();
  return (admins || []).map((a) => a?._id).filter(Boolean);
}
