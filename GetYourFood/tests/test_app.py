import sqlite3
import unittest

from werkzeug.security import check_password_hash

from app import DATABASE, app


class FoodAppTestCase(unittest.TestCase):
    def setUp(self):
        connection = sqlite3.connect(DATABASE)
        connection.execute('DELETE FROM orders')
        connection.execute('DELETE FROM users')
        connection.commit()
        connection.close()
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
            'paymentMethod': 'Card',
        }

        response = self.client.post('/api/orders', json=payload)
        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertTrue(body['success'])
        self.assertTrue(body['orderId'])

    def test_demo_mode_exposes_verification_code(self):
        signup = self.client.post('/api/signup', json={
            'name': 'Sam',
            'email': 'sam@example.com',
            'phone': '+254712345678',
            'password': 'Secret123!',
        })
        self.assertEqual(signup.status_code, 201)
        body = signup.get_json()
        self.assertTrue(body['success'])
        self.assertTrue(body['requiresVerification'])
        self.assertTrue(body['verificationCode'])
        self.assertIn('demoMode', body)

    def test_signup_and_login(self):
        signup = self.client.post('/api/signup', json={
            'name': 'Sam',
            'email': 'sam@example.com',
            'phone': '+254712345678',
            'password': 'Secret123!',
        })
        self.assertEqual(signup.status_code, 201)
        self.assertTrue(signup.get_json()['success'])
        self.assertTrue(signup.get_json()['requiresVerification'])
        self.assertTrue(signup.get_json()['verificationCode'])

        login = self.client.post('/api/login', json={
            'identifier': 'sam@example.com',
            'password': 'Secret123!',
        })
        self.assertEqual(login.status_code, 200)
        data = login.get_json()
        self.assertTrue(data['requiresVerification'])
        self.assertTrue(data['verificationCode'])
        self.assertEqual(data['deliveryTarget'], 'email')
        self.assertEqual(data['deliveryAddress'], 'sam@example.com')

        connection = sqlite3.connect(DATABASE)
        stored_hash = connection.execute('SELECT password FROM users WHERE email = ?', ('sam@example.com',)).fetchone()[0]
        connection.close()
        self.assertNotEqual(stored_hash, 'Secret123!')
        self.assertTrue(check_password_hash(stored_hash, 'Secret123!'))

        verification = self.client.post('/api/verify', json={
            'email': 'sam@example.com',
            'code': data['verificationCode'],
        })
        self.assertEqual(verification.status_code, 200)
        self.assertTrue(verification.get_json()['success'])

        final_login = self.client.post('/api/login', json={
            'identifier': 'sam@example.com',
            'password': 'Secret123!',
        })
        self.assertEqual(final_login.status_code, 200)
        final_data = final_login.get_json()
        self.assertTrue(final_data['requiresVerification'])
        self.assertTrue(final_data['verificationCode'])

    def test_signup_and_login_with_phone(self):
        signup = self.client.post('/api/signup', json={
            'name': 'Grace',
            'email': 'grace@example.com',
            'phone': '+254712345678',
            'password': 'Strong456!',
        })
        self.assertEqual(signup.status_code, 201)
        self.assertTrue(signup.get_json()['success'])
        self.assertTrue(signup.get_json()['requiresVerification'])

        verification = self.client.post('/api/verify', json={
            'phone': '+254712345678',
            'code': signup.get_json()['verificationCode'],
        })
        self.assertEqual(verification.status_code, 200)
        self.assertTrue(verification.get_json()['success'])

        login = self.client.post('/api/login', json={
            'identifier': '0712345678',
            'password': 'Strong456!',
        })
        self.assertEqual(login.status_code, 200)
        data = login.get_json()
        self.assertTrue(data['requiresVerification'])
        self.assertTrue(data['verificationCode'])
        self.assertEqual(data['deliveryTarget'], 'phone')
        self.assertEqual(data['deliveryAddress'], '+254712345678')

        verified = self.client.post('/api/verify', json={
            'phone': '+254712345678',
            'code': data['verificationCode'],
        })
        self.assertEqual(verified.status_code, 200)
        self.assertTrue(verified.get_json()['success'])

    def test_login_generates_verification_for_email_or_phone(self):
        self.client.post('/api/signup', json={
            'name': 'Miriam',
            'email': 'miriam@example.com',
            'phone': '+254712345000',
            'password': 'SafePass1!',
        })

        email_login = self.client.post('/api/login', json={
            'identifier': 'miriam@example.com',
            'password': 'SafePass1!',
        })
        self.assertEqual(email_login.status_code, 200)
        email_body = email_login.get_json()
        self.assertTrue(email_body['requiresVerification'])
        self.assertTrue(email_body['verificationCode'])
        self.assertEqual(email_body['deliveryTarget'], 'email')
        self.assertEqual(email_body['deliveryAddress'], 'miriam@example.com')

        self.client.post('/api/logout', json={})

        self.client.post('/api/signup', json={
            'name': 'David',
            'email': 'david@example.com',
            'phone': '+254712345111',
            'password': 'SecurePass2!',
        })

        phone_login = self.client.post('/api/login', json={
            'identifier': '+254712345111',
            'password': 'SecurePass2!',
        })
        self.assertEqual(phone_login.status_code, 200)
        phone_body = phone_login.get_json()
        self.assertTrue(phone_body['requiresVerification'])
        self.assertTrue(phone_body['verificationCode'])
        self.assertEqual(phone_body['deliveryTarget'], 'phone')
        self.assertEqual(phone_body['deliveryAddress'], '+254712345111')

    def test_resend_verification_uses_same_login_channel(self):
        self.client.post('/api/signup', json={
            'name': 'Rina',
            'email': 'rina@example.com',
            'phone': '+254712345222',
            'password': 'TopSecret3!',
        })

        login = self.client.post('/api/login', json={
            'identifier': 'rina@example.com',
            'password': 'TopSecret3!',
        })
        first_code = login.get_json()['verificationCode']

        resend = self.client.post('/api/resend-verification', json={
            'identifier': 'rina@example.com',
        })
        self.assertEqual(resend.status_code, 200)
        body = resend.get_json()
        self.assertTrue(body['success'])
        self.assertTrue(body['verificationCode'])
        self.assertNotEqual(body['verificationCode'], first_code)
        self.assertEqual(body['deliveryTarget'], 'email')
        self.assertEqual(body['deliveryAddress'], 'rina@example.com')

    def test_expired_verification_code_is_rejected(self):
        signup = self.client.post('/api/signup', json={
            'name': 'Nora',
            'email': 'nora@example.com',
            'phone': '+254712345333',
            'password': 'NoraPass4!',
        })
        self.assertEqual(signup.status_code, 201)

        connection = sqlite3.connect(DATABASE)
        try:
            connection.execute(
                "UPDATE users SET verification_code = ?, verification_expires_at = ? WHERE email = ?",
                ('123456', '2020-01-01T00:00:00+00:00', 'nora@example.com'),
            )
            connection.commit()
        finally:
            connection.close()

        response = self.client.post('/api/verify', json={
            'email': 'nora@example.com',
            'code': '123456',
        })

        self.assertEqual(response.status_code, 401)
        self.assertIn('expired', response.get_json()['message'].lower())

    def test_admin_login_and_dashboard_access(self):
        protected = self.client.get('/admin')
        self.assertEqual(protected.status_code, 302)
        self.assertEqual(protected.location, '/admin/login')

        login = self.client.post('/api/admin/login', json={
            'email': 'admin@getyourfood.local',
            'password': 'Admin123!',
        })
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.get_json()['success'])

        with self.client.session_transaction() as session:
            self.assertEqual(session.get('admin', {}).get('email'), 'admin@getyourfood.local')

        dashboard = self.client.get('/admin')
        self.assertEqual(dashboard.status_code, 200)

    def test_admin_dashboard_lists_orders(self):
        payload = {
            'customerName': 'Admin Check',
            'address': '5 Main Street',
            'restaurantId': 'harbor-bite',
            'items': [{'id': 'fish-and-chips', 'quantity': 1}],
            'total': 17.5,
            'paymentMethod': 'Cash',
        }
        self.client.post('/api/orders', json=payload)

        response = self.client.get('/api/orders')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertTrue(isinstance(data, list))
        self.assertGreater(len(data), 0)

    def test_order_is_retrievable_by_id(self):
        payload = {
            'customerName': 'Tracker User',
            'address': '88 River Road',
            'restaurantId': 'green-bowl',
            'items': [{'id': 'avocado-quinoa', 'quantity': 1}],
            'total': 16.5,
            'paymentMethod': 'Mobile wallet',
        }
        create_response = self.client.post('/api/orders', json=payload)
        order_id = create_response.get_json()['orderId']

        response = self.client.get(f'/api/orders/{order_id}')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['orderId'], order_id)
        self.assertEqual(data['customerName'], 'Tracker User')


if __name__ == '__main__':
    unittest.main()
