import { customerApi } from '../../modules/customer/services/customerApi';

/**
 * Returns or creates a persistent unique visitor identifier for anonymous users.
 */
export const getVisitorId = () => {
    try {
        const storageKey = 'sf_visitor_id';
        let vid = localStorage.getItem(storageKey);
        if (!vid || typeof vid !== 'string' || vid.length < 8) {
            vid = 'v_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
            localStorage.setItem(storageKey, vid);
        }
        return vid;
    } catch {
        return 'fallback_' + Math.random().toString(36).substring(2, 10);
    }
};

/**
 * Tracks an interaction (profile visit, call click, whatsapp click, or contact action)
 * for a Service Provider or Promotional Platform Ad with 24-hr deduplication.
 * Non-blocking fire-and-forget call.
 */
export const trackAdInteraction = async ({ targetType, targetId, interactionType }) => {
    if (!targetType || !targetId || !interactionType) return;
    try {
        const visitorId = getVisitorId();
        await customerApi.trackAdInteraction({
            targetType,
            targetId,
            interactionType,
            visitorId,
        });
    } catch (err) {
        // Silent error to prevent interrupting user actions
        console.debug('[Analytics] trackAdInteraction failed silently:', err?.message || err);
    }
};
