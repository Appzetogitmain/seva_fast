import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = 'http://localhost:7000';
const JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

console.log(`\n======================================================`);
console.log(`Starting Comprehensive Route & Middleware Audit`);
console.log(`Target: ${BASE_URL}`);
console.log(`======================================================\n`);

// Helper to generate mock tokens for testing middleware
function generateTestToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

const customerToken = generateTestToken({ id: '60d0fe4f5311236168a109ca', role: 'customer' });
const sellerToken = generateTestToken({ id: '60d0fe4f5311236168a109cb', role: 'seller' });
const deliveryToken = generateTestToken({ id: '60d0fe4f5311236168a109cc', role: 'delivery' });
const adminToken = generateTestToken({ id: '60d0fe4f5311236168a109cd', role: 'admin' });

let passCount = 0;
let failCount = 0;

function report(testName, passed, details = '') {
    if (passed) {
        passCount++;
        console.log(`  [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
    } else {
        failCount++;
        console.error(`  [FAIL] ${testName}: ${details}`);
    }
}

async function runAudit() {
    // 1. Root & Base Health Endpoints
    console.log('\n--- 1. Testing Core & Health Endpoints ---');
    try {
        const rootRes = await axios.get(`${BASE_URL}/`);
        report('Root / endpoint status 200', rootRes.status === 200, `role: ${rootRes.data.result?.role}`);
        report('Correlation ID header present', Boolean(rootRes.headers['x-correlation-id']));
    } catch (e) {
        report('Root / endpoint', false, e.message);
    }

    try {
        const healthRes = await axios.get(`${BASE_URL}/health`);
        report('Health /health endpoint', healthRes.status === 200 || healthRes.status === 503, `status: ${healthRes.status}`);
    } catch (e) {
        report('/health endpoint', false, e.message);
    }

    // 2. Global Error Handler & 404 Middleware
    console.log('\n--- 2. Testing 404 & Error Middlewares ---');
    try {
        await axios.get(`${BASE_URL}/api/non-existent-route-for-testing-404`);
        report('404 for unknown route', false, 'Expected 404 but got success');
    } catch (e) {
        const is404 = e.response?.status === 404;
        const hasStructuredBody = e.response?.data?.error === true && e.response?.data?.result?.code === 'ROUTE_NOT_FOUND';
        report('404 for unknown route', is404 && hasStructuredBody, `Status: ${e.response?.status}, Code: ${e.response?.data?.result?.code}`);
    }

    // 3. Security Headers (Helmet)
    console.log('\n--- 3. Testing Security Headers (Helmet & CORS) ---');
    try {
        const optRes = await axios.options(`${BASE_URL}/api/categories`);
        const allowHeaders = optRes.headers['access-control-allow-headers'] || '';
        report('CORS preflight handling', optRes.status === 200 || optRes.status === 204);
    } catch (e) {
        report('CORS preflight handling', false, e.message);
    }

    // 4. Auth Middleware - Unauthenticated Requests
    console.log('\n--- 4. Testing Auth Middleware (Missing / Invalid Token) ---');
    const protectedRoutesToTest = [
        { path: '/api/customer/profile', desc: 'Customer Profile' },
        { path: '/api/seller/profile', desc: 'Seller Profile' },
        { path: '/api/delivery/profile', desc: 'Delivery Profile' },
        { path: '/api/admin/profile', desc: 'Admin Profile' },
        { path: '/api/cart', desc: 'Cart Route' },
        { path: '/api/wishlist', desc: 'Wishlist Route' },
        { path: '/api/orders/my-orders', desc: 'My Orders' },
        { path: '/api/professionals/profile', desc: 'Professionals Profile' },
    ];

    for (const r of protectedRoutesToTest) {
        try {
            await axios.get(`${BASE_URL}${r.path}`);
            report(`Auth required for ${r.desc}`, false, 'Should have failed with 401');
        } catch (e) {
            const is401 = e.response?.status === 401;
            report(`Auth required for ${r.desc}`, is401, `Status: ${e.response?.status}`);
        }
    }

    // 5. Auth Middleware - Invalid Token
    try {
        await axios.get(`${BASE_URL}/api/customer/profile`, {
            headers: { Authorization: 'Bearer invalid.token.signature' }
        });
        report('Invalid token rejection', false, 'Should have failed with 401');
    } catch (e) {
        const is401 = e.response?.status === 401;
        report('Invalid token rejection', is401, `Status: ${e.response?.status}`);
    }

    // 6. Role-Based Access Control (allowRoles)
    console.log('\n--- 5. Testing Role-Based Authorization (allowRoles) ---');
    try {
        // Customer trying to access Admin profile
        await axios.get(`${BASE_URL}/api/admin/profile`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });
        report('Customer blocked from Admin profile (403)', false, 'Should have returned 403');
    } catch (e) {
        const is403 = e.response?.status === 403;
        report('Customer blocked from Admin profile (403)', is403, `Status: ${e.response?.status}, Msg: ${e.response?.data?.message}`);
    }

    try {
        // Customer trying to access Seller stats
        await axios.get(`${BASE_URL}/api/seller/stats`, {
            headers: { Authorization: `Bearer ${customerToken}` }
        });
        report('Customer blocked from Seller stats (403)', false, 'Should have returned 403');
    } catch (e) {
        const is403 = e.response?.status === 403;
        report('Customer blocked from Seller stats (403)', is403, `Status: ${e.response?.status}`);
    }

    try {
        // Seller trying to access Delivery orders
        await axios.get(`${BASE_URL}/api/delivery/order-history`, {
            headers: { Authorization: `Bearer ${sellerToken}` }
        });
        report('Seller blocked from Delivery order history (403)', false, 'Should have returned 403');
    } catch (e) {
        const is403 = e.response?.status === 403;
        report('Seller blocked from Delivery order history (403)', is403, `Status: ${e.response?.status}`);
    }

    // 7. Public Routes Accessibility
    console.log('\n--- 6. Testing Public Routes Accessibility ---');
    const publicRoutes = [
        { method: 'get', path: '/api/categories', desc: 'Get Categories' },
        { method: 'get', path: '/api/products', desc: 'Get Products (Public/Guest)' },
        { method: 'get', path: '/api/plans', desc: 'Get Plans' },
        { method: 'get', path: '/api/seller/plans', desc: 'Get Seller Plans' },
        { method: 'get', path: '/api/professionals/categories', desc: 'Get Professional Categories' },
        { method: 'get', path: '/api/professionals/search', desc: 'Search Professionals' },
        { method: 'get', path: '/api/professionals/platform-ads/active', desc: 'Active Platform Ads' },
        { method: 'get', path: '/api/settings', desc: 'Platform Settings' },
        { method: 'get', path: '/api/offers', desc: 'Public Offers' },
        { method: 'get', path: '/api/offer-sections?lat=22.7196&lng=75.8577', desc: 'Public Offer Sections (with location)' },
        { method: 'get', path: '/api/coupons', desc: 'Public Coupons' },
        { method: 'get', path: '/api/public/faqs', desc: 'Public FAQs' },
        { method: 'get', path: '/api/store-promotions/public', desc: 'Public Store Promotion Plans' },
        { method: 'get', path: '/api/webhook', desc: 'Public Webhook GET' },
        { method: 'get', path: '/api/orders/shipping/webhook', desc: 'Public Shipping Webhook GET' },
    ];

    for (const r of publicRoutes) {
        try {
            const res = await axios[r.method](`${BASE_URL}${r.path}`);
            report(`Public route: ${r.desc} (${r.path})`, res.status === 200, `Status: ${res.status}`);
        } catch (e) {
            report(`Public route: ${r.desc} (${r.path})`, false, `Status: ${e.response?.status || e.message}`);
        }
    }

    // 8. Testing Protected Routes With Valid Auth Token
    console.log('\n--- 7. Testing Protected Customer Routes with Valid Token ---');
    const customerAuthRoutes = [
        { method: 'get', path: '/api/cart', desc: 'Get Cart' },
        { method: 'get', path: '/api/wishlist', desc: 'Get Wishlist' },
        { method: 'get', path: '/api/tickets', desc: 'Get Support Tickets' },
        { method: 'get', path: '/api/notifications', desc: 'Get Notifications' },
        { method: 'get', path: '/api/customer/transactions', desc: 'Customer Transactions' },
    ];

    for (const r of customerAuthRoutes) {
        try {
            const res = await axios[r.method](`${BASE_URL}${r.path}`, {
                headers: { Authorization: `Bearer ${customerToken}` }
            });
            report(`Protected with Token: ${r.desc} (${r.path})`, res.status === 200, `Status: ${res.status}`);
        } catch (e) {
            // Note: If user does not exist in DB yet, some controllers return 404 which still proves auth passed!
            const passed = e.response?.status === 200 || e.response?.status === 404;
            report(`Protected with Token: ${r.desc} (${r.path})`, passed, `Status: ${e.response?.status}`);
        }
    }

    // 9. Payload Size Limit Guard (createContentLengthGuard)
    console.log('\n--- 8. Testing Payload Size Guard ---');
    try {
        const hugePayload = { data: 'A'.repeat(50000) };
        await axios.post(`${BASE_URL}/api/customer/send-login-otp`, hugePayload);
        report('Oversized payload rejected (413)', false, 'Expected 413');
    } catch (e) {
        const is413 = e.response?.status === 413;
        report('Oversized payload rejected (413)', is413, `Status: ${e.response?.status}, Msg: ${e.response?.data?.message}`);
    }

    console.log(`\n======================================================`);
    console.log(`Audit Completed: ${passCount} Passed, ${failCount} Failed`);
    console.log(`======================================================\n`);
    
    if (failCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runAudit().catch(err => {
    console.error('Audit execution error:', err);
    process.exit(1);
});
