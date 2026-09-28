import unittest

from app import app


class FoodAppTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_get_restaurants(self):
        response = self.client.get('/api/restaurants')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(isinstance(data, list))
        self.assertGreater(len(data), 0)
        self.assertIn('name', data[0])

    def test_post_order(self):
        payload = {
            'customerName': 'Alicia',
            'address': '12 High Street',
            'restaurantId': 'harbor-bite',
            'items': [{'id': 'cajun-rice-bowl', 'quantity': 2}],
            'total': 38,
        }

        response = self.client.post('/api/orders', json=payload)
        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertTrue(body['success'])
        self.assertTrue(body['orderId'])


if __name__ == '__main__':
    unittest.main()
