/**
 * Quick test script for DeviceToken validation schemas
 * Run: npx ts-node scripts/testDeviceTokenValidation.ts
 */
import { registerTokenSchema, sendNotificationSchema, removeTokenSchema } from '../validations/deviceTokenValidation';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e: any) {
        console.log(`  ❌ ${name}: ${e.message}`);
        failed++;
    }
}

function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
}

console.log('\n🔧 Testing registerTokenSchema...');
test('Valid register body', () => {
    const result = registerTokenSchema.safeParse({
        fcmToken: 'abc123token',
        deviceType: 'android',
        deviceName: 'Samsung Galaxy S24'
    });
    assert(result.success, 'Should pass validation');
});

test('Valid without deviceName (optional)', () => {
    const result = registerTokenSchema.safeParse({
        fcmToken: 'abc123token',
        deviceType: 'ios'
    });
    assert(result.success, 'Should pass without deviceName');
});

test('Reject empty fcmToken', () => {
    const result = registerTokenSchema.safeParse({
        fcmToken: '',
        deviceType: 'android'
    });
    assert(!result.success, 'Should reject empty fcmToken');
});

test('Reject invalid deviceType', () => {
    const result = registerTokenSchema.safeParse({
        fcmToken: 'abc123',
        deviceType: 'windows'
    });
    assert(!result.success, 'Should reject invalid deviceType');
});

test('Reject missing deviceType', () => {
    const result = registerTokenSchema.safeParse({
        fcmToken: 'abc123'
    });
    assert(!result.success, 'Should reject missing deviceType');
});

console.log('\n📤 Testing sendNotificationSchema...');
test('Valid send body', () => {
    const result = sendNotificationSchema.safeParse({
        userId: '507f1f77bcf86cd799439011',
        title: 'Test Notification',
        body: 'Hello World!'
    });
    assert(result.success, 'Should pass validation');
});

test('Valid with data field', () => {
    const result = sendNotificationSchema.safeParse({
        userId: '507f1f77bcf86cd799439011',
        title: 'Order Update',
        body: 'Your order has been confirmed',
        data: { orderId: '12345', type: 'ORDER_CONFIRMED' }
    });
    assert(result.success, 'Should pass with data');
});

test('Reject empty title', () => {
    const result = sendNotificationSchema.safeParse({
        userId: '507f1f77bcf86cd799439011',
        title: '',
        body: 'Hello'
    });
    assert(!result.success, 'Should reject empty title');
});

test('Reject missing userId', () => {
    const result = sendNotificationSchema.safeParse({
        title: 'Test',
        body: 'Hello'
    });
    assert(!result.success, 'Should reject missing userId');
});

console.log('\n🗑️  Testing removeTokenSchema...');
test('Valid remove body', () => {
    const result = removeTokenSchema.safeParse({
        fcmToken: 'token-to-remove'
    });
    assert(result.success, 'Should pass validation');
});

test('Reject empty fcmToken', () => {
    const result = removeTokenSchema.safeParse({
        fcmToken: ''
    });
    assert(!result.success, 'Should reject empty fcmToken');
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
