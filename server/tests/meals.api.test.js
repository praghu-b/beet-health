const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { MealLog } = require('../src/models/MealLog');

const TEST_DATE = '2099-12-31'; // Future date to isolate integration test data

jest.setTimeout(30000);

describe('Beet Express REST API Integration Tests', () => {
  beforeAll(async () => {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is required for integration tests');
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 20000,
    });
    // Clean up any previous test data
    await MealLog.deleteMany({ date: TEST_DATE });
  }, 30000);

  afterAll(async () => {
    // Clean up test documents and close connection
    await MealLog.deleteMany({ date: TEST_DATE });
    await mongoose.connection.close();
  });

  describe('GET /api/health', () => {
    test('returns 200 ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('GET /api/foods', () => {
    test('returns all 30 verified dishes from foods.json', async () => {
      const res = await request(app).get('/api/foods');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(30);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/livekit/token', () => {
    test('generates valid LiveKit access token with room grant', async () => {
      const res = await request(app)
        .get('/api/livekit/token')
        .query({ room: 'test-room', username: 'tester' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(20);
    });
  });

  describe('Meal CRUD: Log, Edit, Delete Flow (Voice-Aligned)', () => {
    test('Scenario 1: Log a meal ("two rotis and a katori of dal for lunch")', async () => {
      const payload = {
        date: TEST_DATE,
        mealType: 'lunch',
        items: [
          { food: 'roti', quantity: 2, unit: 'piece' },
          { food: 'dal_tadka', quantity: 1, unit: 'katori' },
        ],
      };

      const res = await request(app).post('/api/meals').send(payload);
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(2);

      // Verify exact macro calculations
      // Roti 2 pcs = 237.6 kcal
      // Dal 1 katori = 180 kcal
      // Total calories = 417.6 kcal
      expect(res.body.data.totalCalories).toBe(417.6);
      expect(res.body.data.totalProtein).toBe(18.0);
    });

    test('Scenario 1 (Constraint): Reject food outside foods.json ("pizza")', async () => {
      const payload = {
        date: TEST_DATE,
        mealType: 'lunch',
        items: [{ food: 'pizza', quantity: 1, unit: 'slice' }],
      };

      const res = await request(app).post('/api/meals').send(payload);
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not in the verified food database/);
    });

    test('Scenario 2: Edit an entry ("Actually make that three rotis")', async () => {
      const editPayload = {
        date: TEST_DATE,
        mealType: 'lunch',
        foodQuery: 'roti',
        quantity: 3,
        unit: 'piece',
      };

      const res = await request(app).patch('/api/meals/items/update').send(editPayload);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedRoti = res.body.data.items.find((it) => it.foodId === 'roti');
      expect(updatedRoti).toBeDefined();
      expect(updatedRoti.quantity).toBe(3);
      expect(updatedRoti.weightGrams).toBe(120);
      // 3 rotis = 297 * 1.2 = 356.4 kcal + 180 (dal) = 536.4 kcal
      expect(res.body.data.totalCalories).toBe(536.4);
    });

    test('Scenario 3: Delete an entry ("Remove the dal")', async () => {
      const deletePayload = {
        date: TEST_DATE,
        mealType: 'lunch',
        foodQuery: 'dal',
      };

      const res = await request(app).delete('/api/meals/items/delete').send(deletePayload);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Dal is removed, only 3 rotis remain
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].foodId).toBe('roti');
      expect(res.body.data.totalCalories).toBe(356.4);
    });

    test('Daily Summary reflects updated logs', async () => {
      const res = await request(app).get('/api/meals/summary').query({ date: TEST_DATE });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.totalCalories).toBe(356.4);
      expect(res.body.summary.totalItems).toBe(1);
    });
  });
});
