import axiosInstance from "@core/api/axios";

export const aiApi = {
  chat: (data) => axiosInstance.post("/customer/ai/chat", data),
  visualSearch: (data) => axiosInstance.post("/customer/ai/visual-search", data),
};
