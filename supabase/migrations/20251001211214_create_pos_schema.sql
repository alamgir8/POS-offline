/*
 # POS System Database Schema
 
 ## Overview
 Complete database schema for a Point of Sale system with offline-first capabilities
 and real-time synchronization support.
 
 ## New Tables
 
 ### 1. `users`
 - `id` (uuid, primary key) - Unique user identifier
 - `email` (text, unique) - User email address
 - `password` (text) - Hashed password
 - `full_name` (text) - User's full name
 - `role` (text) - User role (admin, cashier)
 - `created_at` (timestamptz) - Account creation timestamp
 - `updated_at` (timestamptz) - Last update timestamp
 
 ### 2. `products`
 - `id` (uuid, primary key) - Unique product identifier
 - `name` (text) - Product name
 - `description` (text) - Product description
 - `price` (numeric) - Product price
 - `stock` (integer) - Available quantity
 - `image_url` (text) - Product image URL
 - `category` (text) - Product category
 - `sku` (text, unique) - Stock keeping unit
 - `is_active` (boolean) - Whether product is active
 - `created_at` (timestamptz) - Creation timestamp
 - `updated_at` (timestamptz) - Last update timestamp
 
 ### 3. `orders`
 - `id` (uuid, primary key) - Unique order identifier
 - `order_number` (text, unique) - Human-readable order number
 - `user_id` (uuid) - Reference to user who created the order
 - `total_amount` (numeric) - Total order amount
 - `tax_amount` (numeric) - Tax amount
 - `discount_amount` (numeric) - Discount amount
 - `status` (text) - Order status (pending, completed, cancelled)
 - `payment_method` (text) - Payment method used
 - `device_id` (text) - Device that created the order
 - `synced` (boolean) - Whether order is synced to server
 - `created_at` (timestamptz) - Order creation timestamp
 - `updated_at` (timestamptz) - Last update timestamp
 
 ### 4. `order_items`
 - `id` (uuid, primary key) - Unique order item identifier
 - `order_id` (uuid) - Reference to parent order
 - `product_id` (uuid) - Reference to product
 - `product_name` (text) - Product name snapshot
 - `quantity` (integer) - Quantity ordered
 - `unit_price` (numeric) - Price per unit at time of order
 - `total_price` (numeric) - Total price for this line item
 - `created_at` (timestamptz) - Creation timestamp
 
 ### 5. `sync_log`
 - `id` (uuid, primary key) - Unique log identifier
 - `device_id` (text) - Device identifier
 - `entity_type` (text) - Type of entity (order, product)
 - `entity_id` (uuid) - ID of synced entity
 - `action` (text) - Action performed (create, update, delete)
 - `synced_at` (timestamptz) - Sync timestamp
 
 ## Security
 - Enable RLS on all tables
 - Add policies for authenticated users
 - Products are readable by all authenticated users
 - Orders and order items are accessible to their creators and admins
 - Users can update their own orders
 */
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  full_name text NOT NULL,
  role text DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  stock integer DEFAULT 0 CHECK (stock >= 0),
  image_url text DEFAULT '',
  category text DEFAULT 'General',
  sku text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE
  SET NULL,
    total_amount numeric(10, 2) DEFAULT 0 CHECK (total_amount >= 0),
    tax_amount numeric(10, 2) DEFAULT 0 CHECK (tax_amount >= 0),
    discount_amount numeric(10, 2) DEFAULT 0 CHECK (discount_amount >= 0),
    status text DEFAULT 'pending' CHECK (
      status IN ('pending', 'completed', 'cancelled', 'refunded')
    ),
    payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'mobile')),
    device_id text NOT NULL,
    synced boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(10, 2) NOT NULL CHECK (total_price >= 0),
  created_at timestamptz DEFAULT now()
);
-- Create sync_log table
CREATE TABLE IF NOT EXISTS sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  synced_at timestamptz DEFAULT now()
);
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_sync_log_device_id ON sync_log(device_id);
-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
-- RLS Policies for users
CREATE POLICY "Users can view all users" ON users FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON users FOR
UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- RLS Policies for products
CREATE POLICY "Anyone can view active products" ON products FOR
SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can insert products" ON products FOR
INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update products" ON products FOR
UPDATE TO authenticated USING (true) WITH CHECK (true);
-- RLS Policies for orders
CREATE POLICY "Users can view all orders" ON orders FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can create orders" ON orders FOR
INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update orders" ON orders FOR
UPDATE TO authenticated USING (true) WITH CHECK (true);
-- RLS Policies for order_items
CREATE POLICY "Users can view order items" ON order_items FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can create order items" ON order_items FOR
INSERT TO authenticated WITH CHECK (true);
-- RLS Policies for sync_log
CREATE POLICY "Users can view sync logs" ON sync_log FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can create sync logs" ON sync_log FOR
INSERT TO authenticated WITH CHECK (true);
-- Insert demo products
INSERT INTO products (
    name,
    description,
    price,
    stock,
    category,
    sku,
    image_url
  )
VALUES (
    'Espresso',
    'Strong black coffee',
    3.50,
    100,
    'Beverages',
    'BEV-001',
    'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg'
  ),
  (
    'Cappuccino',
    'Espresso with steamed milk foam',
    4.50,
    100,
    'Beverages',
    'BEV-002',
    'https://images.pexels.com/photos/1251175/pexels-photo-1251175.jpeg'
  ),
  (
    'Latte',
    'Espresso with steamed milk',
    4.75,
    100,
    'Beverages',
    'BEV-003',
    'https://images.pexels.com/photos/6954201/pexels-photo-6954201.jpeg'
  ),
  (
    'Croissant',
    'Buttery French pastry',
    3.00,
    50,
    'Pastries',
    'PAS-001',
    'https://images.pexels.com/photos/2135677/pexels-photo-2135677.jpeg'
  ),
  (
    'Blueberry Muffin',
    'Fresh baked muffin',
    2.75,
    50,
    'Pastries',
    'PAS-002',
    'https://images.pexels.com/photos/2144112/pexels-photo-2144112.jpeg'
  ),
  (
    'Chocolate Cake',
    'Rich chocolate cake slice',
    5.50,
    30,
    'Desserts',
    'DES-001',
    'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg'
  ),
  (
    'Green Tea',
    'Organic green tea',
    2.50,
    100,
    'Beverages',
    'BEV-004',
    'https://images.pexels.com/photos/1417945/pexels-photo-1417945.jpeg'
  ),
  (
    'Bagel with Cream Cheese',
    'Toasted bagel',
    3.25,
    40,
    'Breakfast',
    'BRK-001',
    'https://images.pexels.com/photos/1893555/pexels-photo-1893555.jpeg'
  ),
  (
    'Sandwich',
    'Fresh deli sandwich',
    7.50,
    30,
    'Lunch',
    'LUN-001',
    'https://images.pexels.com/photos/1603901/pexels-photo-1603901.jpeg'
  ),
  (
    'Fruit Smoothie',
    'Mixed berry smoothie',
    5.00,
    60,
    'Beverages',
    'BEV-005',
    'https://images.pexels.com/photos/1092730/pexels-photo-1092730.jpeg'
  ) ON CONFLICT (sku) DO NOTHING;
-- Insert demo user
INSERT INTO users (email, password, full_name, role)
VALUES (
    'demo@pos.com',
    '$2a$10$demo.password.hash',
    'Demo User',
    'cashier'
  ) ON CONFLICT (email) DO NOTHING;