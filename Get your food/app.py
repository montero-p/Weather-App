from flask import Flask, jsonify, render_template, request

app = Flask(__name__, template_folder="templates", static_folder="static")

restaurants = [
    {
        "id": "harbor-bite",
        "name": "Harbor Bite",
        "cuisine": "Seafood & Grill",
        "location": "Waterfront Plaza",
        "rating": 4.8,
        "deliveryTime": "20-30 min",
        "deliveryFee": 2.5,
        "banner": "Fresh catch and smoky grills by the water.",
        "menu": [
            {"id": "cajun-rice-bowl", "name": "Cajun Rice Bowl", "price": 16.5, "description": "Grilled shrimp, rice, veg, and lime aioli.", "tag": "Popular"},
            {"id": "firecracker-tacos", "name": "Firecracker Tacos", "price": 14.0, "description": "Crispy tacos with chipotle slaw and house salsa.", "tag": "Hot"},
            {"id": "fish-and-chips", "name": "Fish & Chips", "price": 17.5, "description": "Crispy cod with hand-cut fries and tartar sauce.", "tag": "Classic"},
            {"id": "garden-salad", "name": "Garden Salad", "price": 10.5, "description": "Mixed greens, tomatoes, cucumber, and lemon vinaigrette.", "tag": "Fresh"},
        ],
    },
    {
        "id": "copper-kitchen",
        "name": "Copper Kitchen",
        "cuisine": "Italian",
        "location": "Market Street",
        "rating": 4.9,
        "deliveryTime": "25-35 min",
        "deliveryFee": 3.0,
        "banner": "Authentic pizza and handmade pasta for slow evenings.",
        "menu": [
            {"id": "margherita-pizza", "name": "Margherita Pizza", "price": 18.0, "description": "Wood-fired crust with tomato sauce and basil.", "tag": "Favorite"},
            {"id": "truffle-pasta", "name": "Truffle Mushroom Pasta", "price": 19.5, "description": "Creamy parmesan sauce with roasted mushrooms.", "tag": "Chef's pick"},
            {"id": "garlic-bread", "name": "Garlic Bread", "price": 8.0, "description": "Toasted artisan loaf with roasted garlic butter.", "tag": "Side"},
            {"id": "caesar-salad", "name": "Caesar Salad", "price": 11.0, "description": "Romaine, parmesan, croutons, and creamy dressing.", "tag": "Fresh"},
        ],
    },
    {
        "id": "green-bowl",
        "name": "Green Bowl",
        "cuisine": "Healthy & Vegan",
        "location": "Oak Avenue",
        "rating": 4.7,
        "deliveryTime": "15-25 min",
        "deliveryFee": 1.5,
        "banner": "Bright, nutrient-packed meals made for busy days.",
        "menu": [
            {"id": "avocado-quinoa", "name": "Avocado Quinoa Bowl", "price": 15.0, "description": "Quinoa, avocado, roasted sweet potato, and greens.", "tag": "Vegan"},
            {"id": "green-smoothie", "name": "Green Smoothie", "price": 7.5, "description": "Spinach, banana, pineapple, and coconut water.", "tag": "Drink"},
            {"id": "chickpea-wrap", "name": "Chickpea Wrap", "price": 13.5, "description": "Herby chickpeas, crunchy lettuce, and tahini sauce.", "tag": "Popular"},
            {"id": "protein-plate", "name": "Protein Plate", "price": 17.0, "description": "Grilled tofu, greens, grains, and tahini drizzle.", "tag": "Protein"},
        ],
    },
    {
        "id": "sunset-spice",
        "name": "Sunset Spice",
        "cuisine": "Indian",
        "location": "Town Centre",
        "rating": 4.6,
        "deliveryTime": "20-30 min",
        "deliveryFee": 2.0,
        "banner": "Bold curries, tandoori favorites, and comforting breads.",
        "menu": [
            {"id": "butter-chicken", "name": "Butter Chicken", "price": 18.5, "description": "Creamy tomato curry with tender chicken.", "tag": "Classic"},
            {"id": "paneer-tikka", "name": "Paneer Tikka", "price": 16.0, "description": "Chargrilled paneer cubes in spiced yogurt marinade.", "tag": "Vegetarian"},
            {"id": "naan-platter", "name": "Naan Platter", "price": 9.5, "description": "Garlic, butter, and coriander flatbreads.", "tag": "Side"},
            {"id": "mango-lassi", "name": "Mango Lassi", "price": 6.5, "description": "Sweet yogurt drink blended with mango.", "tag": "Drink"},
        ],
    },
]

orders = []


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/restaurants")
def get_restaurants():
    return jsonify(restaurants)


@app.route("/api/orders", methods=["POST"])
def create_order():
    payload = request.get_json(silent=True) or {}

    customer_name = (payload.get("customerName") or "").strip()
    address = (payload.get("address") or "").strip()
    restaurant_id = (payload.get("restaurantId") or "").strip()
    items = payload.get("items") or []
    total = float(payload.get("total") or 0)

    if not customer_name or not address or not restaurant_id or not items:
        return jsonify({"success": False, "message": "Please complete your order details."}), 400

    restaurant = next((entry for entry in restaurants if entry["id"] == restaurant_id), None)
    if restaurant is None:
        return jsonify({"success": False, "message": "The selected restaurant could not be found."}), 400

    order = {
        "orderId": f"GF-{len(orders) + 1:04d}",
        "customerName": customer_name,
        "restaurantId": restaurant_id,
        "restaurantName": restaurant["name"],
        "address": address,
        "items": items,
        "total": round(total, 2),
        "status": "Confirmed",
    }
    orders.append(order)

    return jsonify({"success": True, "orderId": order["orderId"], "message": "Your order has been placed."}), 201


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
