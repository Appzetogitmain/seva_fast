import axiosInstance from '@core/api/axios';

export const planApi = {
    getPlans: () => axiosInstance.get('/plans'),
    createPlan: (data) => axiosInstance.post('/plans', data),
    updatePlan: (id, data) => axiosInstance.put(`/plans/${id}`, data),
    deletePlan: (id) => axiosInstance.delete(`/plans/${id}`),
    subscribe: (planId) => axiosInstance.post('/plans/subscribe/initiate', { planId }),
};
