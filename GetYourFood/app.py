import json
import os
import random
import re
import smtplib
import sqlite3
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from flask import Flask, jsonify, redirect, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash

try:
    from twilio.rest import Client as TwilioClient
except ImportError:  # pragma: no cover - optional dependency for SMS sends
    TwilioClient = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "getyourfood.db")

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = "get-your-food-local-dev-key"

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@getyourfood.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin123!")


def get_db_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def normalize_phone(phone):
    if phone is None:
        return ""

    digits = "".join(char for char in str(phone).strip() if char.isdigit())
    if not digits:
        return ""

    if digits.startswith("0") and len(digits) == 10:
        return "+254" + digits[1:]
    if digits.startswith("254") and len(digits) == 12:
        return "+" + digits
    if digits.startswith("7") and len(digits) == 9:
        return "+254" + digits
    if digits.startswith("+254"):
        return "+254" + digits[4:]
    return "+" + digits if not digits.startswith("+") else digits


def ensure_user_phone_column():
    connection = get_db_connection()
    try:
        columns = [row["name"] for row in connection.execute("PRAGMA table_info(users)").fetchall()]
        if "phone" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN phone TEXT")
            connection.commit()
        if "verified" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0")
            connection.commit()
        if "verification_code" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN verification_code TEXT")
            connection.commit()
        if "verification_expires_at" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN verification_expires_at TEXT")
            connection.commit()
    finally:
        connection.close()


def generate_verification_code():
    return str(random.randint(100000, 999999))


def send_verification_email(email, code):
    mail_server = os.environ.get("MAIL_SERVER")
    if not mail_server or not email:
        print(f"[DEV EMAIL] Verification code for {email}: {code}")
        return True

    sender = os.environ.get("MAIL_SENDER", "noreply@getyourfood.local")
    password = os.environ.get("MAIL_PASSWORD")
    port = int(os.environ.get("MAIL_PORT", "587"))
    use_tls = os.environ.get("MAIL_USE_TLS", "true").lower() in {"1", "true", "yes", "on"}

    message = EmailMessage()
    message["Subject"] = "Get Your Food verification code"
    message["From"] = sender
    message["To"] = email
    message.set_content(
        "Your verification code is "
        f"{code}.\n\n"
        "Enter this code in the app to finish creating your account."
    )

    try:
        server = smtplib.SMTP(mail_server, port)
        if use_tls:
            server.starttls()
        if password:
            server.login(sender, password)
        server.send_message(message)
        server.quit()
        return True
    except Exception as exc:
        print(f"[EMAIL ERROR] Could not send verification email to {email}: {exc}")
        return False


def send_verification_sms(phone, code):
    if not phone:
        print(f"[DEV SMS] Verification code for unknown phone: {code}")
        return True

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER")

    if not account_sid or not auth_token or not from_number or TwilioClient is None:
        print(f"[DEV SMS] Verification code for {phone}: {code}")
        return True

    try:
        client = TwilioClient(account_sid, auth_token)
        client.messages.create(
            body=f"Your Get Your Food verification code is {code}. Enter it to continue.",
            from_=from_number,
            to=phone,
        )
        return True
    except Exception as exc:
        print(f"[SMS ERROR] Could not send verification SMS to {phone}: {exc}")
        return False


def send_verification_message(contact_type, destination, code):
    if contact_type == "email":
        return send_verification_email(destination, code)
    if contact_type == "phone":
        return send_verification_sms(destination, code)
    return False


def issue_verification_for_user(user, preferred_type=None):
    if preferred_type in {"phone", "email"}:
        contact_type = preferred_type
    elif user.get("phone"):
        contact_type = "phone"
    else:
        contact_type = "email"

    if contact_type == "email":
        delivery_address = user.get("email") or user.get("phone")
    else:
        delivery_address = user.get("phone") or user.get("email")

    if not delivery_address:
        return None

    verification_code = generate_verification_code()
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    connection = get_db_connection()
    try:
        connection.execute(
            "UPDATE users SET verification_code = ?, verification_expires_at = ?, verified = 0 WHERE id = ?",
            (verification_code, expires_at, user["id"]),
        )
        connection.commit()
    finally:
        connection.close()

    send_verification_message(contact_type, delivery_address, verification_code)
    return {
        "verificationCode": verification_code,
        "deliveryTarget": contact_type,
        "deliveryAddress": delivery_address,
    }


def init_db():
    with get_db_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                password TEXT NOT NULL,
                verified INTEGER NOT NULL DEFAULT 0,
                verification_code TEXT,
                verification_expires_at TEXT
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL UNIQUE,
                customer_name TEXT NOT NULL,
                address TEXT NOT NULL,
                restaurant_id TEXT NOT NULL,
                restaurant_name TEXT NOT NULL,
                items TEXT NOT NULL,
                total REAL NOT NULL,
                payment_method TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


init_db()
ensure_user_phone_column()

restaurants = [
    {
        "id": "harbor-bite",
        "name": "Harbor Bite",
        "cuisine": "Seafood & Grill",
        "location": "Waterfront Plaza",
        "rating": 4.8,
        "deliveryTime": "20-30 min",
        "deliveryFee": 250,
        "banner": "Fresh catch and smoky grills by the water.",
        "menu": [
            {"id": "cajun-rice-bowl", "name": "Cajun Rice Bowl", "price": 1650, "description": "Grilled shrimp, rice, veg, and lime aioli.", "tag": "Popular"},
            {"id": "firecracker-tacos", "name": "Firecracker Tacos", "price": 1400, "description": "Crispy tacos with chipotle slaw and house salsa.", "tag": "Hot"},
            {"id": "fish-and-chips", "name": "Fish & Chips", "price": 1750, "description": "Crispy cod with hand-cut fries and tartar sauce.", "tag": "Classic"},
            {"id": "garden-salad", "name": "Garden Salad", "price": 1050, "description": "Mixed greens, tomatoes, cucumber, and lemon vinaigrette.", "tag": "Fresh"},
        ],
    },
    {
        "id": "copper-kitchen",
        "name": "Copper Kitchen",
        "cuisine": "Italian",
        "location": "Market Street",
        "rating": 4.9,
        "deliveryTime": "25-35 min",
        "deliveryFee": 300,
        "banner": "Authentic pizza and handmade pasta for slow evenings.",
        "menu": [
            {"id": "margherita-pizza", "name": "Margherita Pizza", "price": 1800, "description": "Wood-fired crust with tomato sauce and basil.", "tag": "Favorite"},
            {"id": "truffle-pasta", "name": "Truffle Mushroom Pasta", "price": 1950, "description": "Creamy parmesan sauce with roasted mushrooms.", "tag": "Chef's pick"},
            {"id": "garlic-bread", "name": "Garlic Bread", "price": 800, "description": "Toasted artisan loaf with roasted garlic butter.", "tag": "Side"},
            {"id": "caesar-salad", "name": "Caesar Salad", "price": 1100, "description": "Romaine, parmesan, croutons, and creamy dressing.", "tag": "Fresh"},
        ],
    },
    {
        "id": "green-bowl",
        "name": "Green Bowl",
        "cuisine": "Healthy & Vegan",
        "location": "Oak Avenue",
        "rating": 4.7,
        "deliveryTime": "15-25 min",
        "deliveryFee": 150,
        "banner": "Bright, nutrient-packed meals made for busy days.",
        "menu": [
            {"id": "avocado-quinoa", "name": "Avocado Quinoa Bowl", "price": 1500, "description": "Quinoa, avocado, roasted sweet potato, and greens.", "tag": "Vegan"},
            {"id": "green-smoothie", "name": "Green Smoothie", "price": 750, "description": "Spinach, banana, pineapple, and coconut water.", "tag": "Drink"},
            {"id": "chickpea-wrap", "name": "Chickpea Wrap", "price": 1350, "description": "Herby chickpeas, crunchy lettuce, and tahini sauce.", "tag": "Popular"},
            {"id": "protein-plate", "name": "Protein Plate", "price": 1700, "description": "Grilled tofu, greens, grains, and tahini drizzle.", "tag": "Protein"},
        ],
    },
    {
        "id": "sunset-spice",
        "name": "Sunset Spice",
        "cuisine": "Indian",
        "location": "Town Centre",
        "rating": 4.6,
        "deliveryTime": "20-30 min",
        "deliveryFee": 200,
        "banner": "Bold curries, tandoori favorites, and comforting breads.",
        "menu": [
            {"id": "butter-chicken", "name": "Butter Chicken", "price": 1850, "description": "Creamy tomato curry with tender chicken.", "tag": "Classic"},
            {"id": "paneer-tikka", "name": "Paneer Tikka", "price": 1600, "description": "Chargrilled paneer cubes in spiced yogurt marinade.", "tag": "Vegetarian"},
            {"id": "naan-platter", "name": "Naan Platter", "price": 950, "description": "Garlic, butter, and coriander flatbreads.", "tag": "Side"},
            {"id": "mango-lassi", "name": "Mango Lassi", "price": 650, "description": "Sweet yogurt drink blended with mango.", "tag": "Drink"},
        ],
    },
]

def fetch_orders():
    connection = get_db_connection()
    try:
        rows = connection.execute(
            "SELECT * FROM orders ORDER BY id DESC"
        ).fetchall()
        return [
            {
                "id": row["id"],
                "orderId": row["order_id"],
                "customerName": row["customer_name"],
                "restaurantId": row["restaurant_id"],
                "restaurantName": row["restaurant_name"],
                "address": row["address"],
                "items": json.loads(row["items"]),
                "total": row["total"],
                "paymentMethod": row["payment_method"],
                "status": row["status"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]
    finally:
        connection.close()


def fetch_user_by_email(email):
    connection = get_db_connection()
    try:
        row = connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "phone": row["phone"],
            "password": row["password"],
            "verified": bool(row["verified"]),
            "verification_code": row["verification_code"],
            "verification_expires_at": row["verification_expires_at"],
        }
    finally:
        connection.close()


def fetch_user_by_phone(phone):
    normalized_phone = normalize_phone(phone)
    if not normalized_phone:
        return None

    connection = get_db_connection()
    try:
        row = connection.execute(
            "SELECT * FROM users WHERE phone = ?",
            (normalized_phone,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "phone": row["phone"],
            "password": row["password"],
            "verified": bool(row["verified"]),
            "verification_code": row["verification_code"],
            "verification_expires_at": row["verification_expires_at"],
        }
    finally:
        connection.close()


def fetch_user_by_identifier(identifier):
    value = (identifier or "").strip()
    if not value:
        return None

    if "@" in value:
        return fetch_user_by_email(value.lower())
    return fetch_user_by_phone(value)


def is_verification_expired(user):
    expires_at = (user or {}).get("verification_expires_at")
    if not expires_at:
        return False

    try:
        expiration_time = datetime.fromisoformat(expires_at)
        if expiration_time.tzinfo is None:
            expiration_time = expiration_time.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) > expiration_time
    except (TypeError, ValueError):
        return False


def password_matches(stored_password, candidate_password):
    if not stored_password:
        return False
    try:
        return check_password_hash(stored_password, candidate_password)
    except ValueError:
        return stored_password == candidate_password


def get_order_by_id(order_id):
    connection = get_db_connection()
    try:
        row = connection.execute(
            "SELECT * FROM orders WHERE order_id = ?",
            (order_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "orderId": row["order_id"],
            "customerName": row["customer_name"],
            "restaurantId": row["restaurant_id"],
            "restaurantName": row["restaurant_name"],
            "address": row["address"],
            "items": json.loads(row["items"]),
            "total": row["total"],
            "paymentMethod": row["payment_method"],
            "status": row["status"],
            "createdAt": row["created_at"],
        }
    finally:
        connection.close()


@app.route("/")
def index():
    return render_template("index.html", user=session.get("user"))


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        payload = request.get_json(silent=True) or request.form
        email = (payload.get("email") or "").strip().lower()
        password = (payload.get("password") or "").strip()

        if email == ADMIN_EMAIL and password == ADMIN_PASSWORD:
            session["admin"] = {"name": "Administrator", "email": ADMIN_EMAIL}
            session.pop("user", None)
            if request.is_json:
                return jsonify({"success": True, "message": "Admin login successful.", "redirect": "/admin"})
            return redirect("/admin")

        error_message = "Invalid administrator email or password."
        if request.is_json:
            return jsonify({"success": False, "message": error_message}), 401
        return render_template("admin_login.html", error=error_message)

    return render_template("admin_login.html")


@app.route("/admin")
def admin_dashboard():
    if not session.get("admin"):
        return redirect("/admin/login")
    return render_template("admin.html", user=session.get("admin"), orders=fetch_orders())


@app.route("/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return redirect("/admin/login")


@app.route("/api/admin/login", methods=["POST"])
def api_admin_login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = (payload.get("password") or "").strip()

    if email == ADMIN_EMAIL and password == ADMIN_PASSWORD:
        session["admin"] = {"name": "Administrator", "email": ADMIN_EMAIL}
        return jsonify({"success": True, "message": "Admin login successful.", "redirect": "/admin"})

    return jsonify({"success": False, "message": "Invalid administrator email or password."}), 401


@app.route("/api/admin/logout", methods=["POST"])
def api_admin_logout():
    session.pop("admin", None)
    return jsonify({"success": True, "message": "Admin logged out."})


@app.route("/api/user")
def get_current_user():
    return jsonify({"user": session.get("user")})


@app.route("/api/restaurants")
def get_restaurants():
    return jsonify(restaurants)


@app.route("/api/signup", methods=["POST"])
def signup_user():
    payload = request.get_json(silent=True) or {}

    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    phone = normalize_phone(payload.get("phone") or "")
    password = (payload.get("password") or "").strip()

    if not name or not email or not phone or not password:
        return jsonify({"success": False, "message": "Please provide your name, both your phone number and email, and a password."}), 400

    if len(password) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters long."}), 400

    if not re.search(r"[A-Z]", password):
        return jsonify({"success": False, "message": "Password must include at least 1 uppercase letter."}), 400

    if not re.search(r"\d", password):
        return jsonify({"success": False, "message": "Password must include at least 1 number."}), 400

    if not re.search(r"[^A-Za-z0-9]", password):
        return jsonify({"success": False, "message": "Password must include at least 1 special character."}), 400

    if fetch_user_by_email(email) is not None:
        return jsonify({"success": False, "message": "This email is already registered."}), 409

    if fetch_user_by_phone(phone) is not None:
        return jsonify({"success": False, "message": "This phone number is already registered."}), 409

    hashed_password = generate_password_hash(password)
    verification_code = generate_verification_code()
    connection = get_db_connection()
    try:
        connection.execute(
            "INSERT INTO users (name, email, phone, password, verified, verification_code) VALUES (?, ?, ?, ?, 0, ?)",
            (name, email, phone, hashed_password, verification_code),
        )
        connection.commit()
    finally:
        connection.close()

    phone_sent = send_verification_sms(phone, verification_code)
    email_sent = send_verification_email(email, verification_code) if not phone_sent else True
    demo_mode = not (os.environ.get("MAIL_SERVER") or os.environ.get("TWILIO_ACCOUNT_SID"))
    response_message = (
        "Your verification code has been sent to your phone. Enter it to complete your account setup."
        if phone
        else "Your verification code has been sent. Enter it to complete your account setup."
    )
    if demo_mode:
        response_message = (
            f"Demo mode is active. Use this code to verify your account: {verification_code}"
        )

    return jsonify({
        "success": True,
        "user": {"name": name, "email": email, "phone": phone},
        "requiresVerification": True,
        "verificationCode": verification_code,
        "demoMode": demo_mode,
        "message": response_message,
    }), 201


@app.route("/api/login", methods=["POST"])
def login_user():
    payload = request.get_json(silent=True) or {}

    identifier = (payload.get("identifier") or payload.get("email") or payload.get("phone") or "").strip()
    password = (payload.get("password") or "").strip()

    if not identifier or not password:
        return jsonify({"success": False, "message": "Phone number, email, and password are required."}), 400

    user = fetch_user_by_identifier(identifier)
    if not user or not password_matches(user["password"], password):
        return jsonify({"success": False, "message": "Invalid phone/email or password."}), 401

    contact_type = "email" if "@" in identifier else "phone"
    verification_payload = issue_verification_for_user(user, preferred_type=contact_type)
    if verification_payload is None:
        return jsonify({"success": False, "message": "No valid contact method is available for verification."}), 400

    demo_mode = not (os.environ.get("MAIL_SERVER") or os.environ.get("TWILIO_ACCOUNT_SID"))
    message = f"A new verification code has been sent to your {verification_payload['deliveryTarget']}."
    if demo_mode:
        message = f"Demo mode is active. Use this code to verify your account: {verification_payload['verificationCode']}"

    return jsonify({
        "success": True,
        "requiresVerification": True,
        "verificationCode": verification_payload["verificationCode"],
        "deliveryTarget": verification_payload["deliveryTarget"],
        "deliveryAddress": verification_payload["deliveryAddress"],
        "demoMode": demo_mode,
        "message": message,
    })


@app.route("/api/resend-verification", methods=["POST"])
def resend_verification():
    payload = request.get_json(silent=True) or {}
    identifier = (payload.get("identifier") or payload.get("email") or payload.get("phone") or "").strip()
    password = (payload.get("password") or "").strip()

    if not identifier:
        return jsonify({"success": False, "message": "Your email or phone is required to resend the code."}), 400

    user = fetch_user_by_identifier(identifier)
    if not user:
        return jsonify({"success": False, "message": "We could not find that account."}), 404

    if password and not password_matches(user["password"], password):
        return jsonify({"success": False, "message": "Incorrect password."}), 401

    contact_type = "email" if "@" in identifier else "phone"
    verification_payload = issue_verification_for_user(user, preferred_type=contact_type)
    if verification_payload is None:
        return jsonify({"success": False, "message": "No valid contact method is available for verification."}), 400

    demo_mode = not (os.environ.get("MAIL_SERVER") or os.environ.get("TWILIO_ACCOUNT_SID"))
    message = f"A new verification code has been sent to your {verification_payload['deliveryTarget']}."
    if demo_mode:
        message = f"Demo mode is active. Use this code to verify your account: {verification_payload['verificationCode']}"

    return jsonify({
        "success": True,
        "requiresVerification": True,
        "verificationCode": verification_payload["verificationCode"],
        "deliveryTarget": verification_payload["deliveryTarget"],
        "deliveryAddress": verification_payload["deliveryAddress"],
        "demoMode": demo_mode,
        "message": message,
    })


@app.route("/api/verify", methods=["POST"])
def verify_user():
    payload = request.get_json(silent=True) or {}

    email = (payload.get("email") or "").strip().lower()
    phone = normalize_phone(payload.get("phone") or "")
    code = (payload.get("code") or "").strip()

    if not code:
        return jsonify({"success": False, "message": "Verification code is required."}), 400

    user = None
    if email:
        user = fetch_user_by_email(email)
    if user is None and phone:
        user = fetch_user_by_phone(phone)

    if user is None:
        return jsonify({"success": False, "message": "Account not found. Please check your phone or email."}), 404

    if is_verification_expired(user):
        connection = get_db_connection()
        try:
            connection.execute(
                "UPDATE users SET verified = 0, verification_code = NULL, verification_expires_at = NULL WHERE id = ?",
                (user["id"],),
            )
            connection.commit()
        finally:
            connection.close()
        return jsonify({"success": False, "message": "Verification code has expired. Please request a new code."}), 401

    if str(user.get("verification_code") or "").strip() != code:
        return jsonify({"success": False, "message": "Incorrect verification code. Please try again."}), 401

    connection = get_db_connection()
    try:
        connection.execute(
            "UPDATE users SET verified = 1, verification_code = NULL, verification_expires_at = NULL WHERE id = ?",
            (user["id"],),
        )
        connection.commit()
    finally:
        connection.close()

    session["user"] = {"name": user["name"], "email": user["email"] or "", "phone": user["phone"] or ""}
    return jsonify({
        "success": True,
        "user": session["user"],
        "message": f"Verification successful. Welcome, {user['name']}!",
    })


@app.route("/api/logout", methods=["POST"])
def logout_user():
    session.pop("user", None)
    return jsonify({"success": True, "message": "Logged out successfully."})


@app.route("/api/orders", methods=["GET", "POST"])
def handle_orders():
    if request.method == "GET":
        return jsonify(fetch_orders())

    payload = request.get_json(silent=True) or {}

    customer_name = (payload.get("customerName") or "").strip()
    address = (payload.get("address") or "").strip()
    restaurant_id = (payload.get("restaurantId") or "").strip()
    items = payload.get("items") or []
    total = float(payload.get("total") or 0)
    payment_method = (payload.get("paymentMethod") or "Cash").strip() or "Cash"

    if not customer_name or not address or not restaurant_id or not items:
        return jsonify({"success": False, "message": "Please complete your order details."}), 400

    restaurant = next((entry for entry in restaurants if entry["id"] == restaurant_id), None)
    if restaurant is None:
        return jsonify({"success": False, "message": "The selected restaurant could not be found."}), 400

    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    connection = get_db_connection()
    try:
        cursor = connection.execute(
            """
            INSERT INTO orders (order_id, customer_name, address, restaurant_id, restaurant_name, items, total, payment_method, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "",
                customer_name,
                address,
                restaurant_id,
                restaurant["name"],
                json.dumps(items),
                round(total, 2),
                payment_method,
                "Confirmed",
                created_at,
            ),
        )
        order_id = f"GF-{cursor.lastrowid:04d}"
        connection.execute(
            "UPDATE orders SET order_id = ? WHERE id = ?",
            (order_id, cursor.lastrowid),
        )
        connection.commit()
    finally:
        connection.close()

    return jsonify({"success": True, "orderId": order_id, "message": "Your order has been placed."}), 201


@app.route("/api/orders/<order_id>", methods=["GET"])
def get_order(order_id):
    order = get_order_by_id(order_id)
    if order is None:
        return jsonify({"success": False, "message": "Order not found."}), 404
    return jsonify(order)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
