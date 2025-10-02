import React, { useState } from 'react';
import type { Product } from '../types';
import { demoProducts, categories } from '../data/products';
import { soundManager } from '../utils/soundManager';

interface ProductGridProps {
  onAddToCart: (product: Product) => void;
}

const ProductGridEnhanced: React.FC<ProductGridProps> = ({ onAddToCart }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  const filteredProducts = demoProducts.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddToCart = async (product: Product) => {
    setAddingToCart(product.id);
    // Play add to cart sound
    soundManager.playAddToCart();
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 300));
    onAddToCart(product);
    setAddingToCart(null);
  };

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate data refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gradient mb-1">Products</h2>
          <p className="text-gray-600">Choose items to add to cart</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="status-online">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Stock Live</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
  });

  const handleAddToCart = async (product: Product) => {
    setAddingToCart(product.id);
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 300));
    onAddToCart(product);
    setAddingToCart(null);
  };

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate data refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gradient mb-1">Products</h2>
          <p className="text-gray-600">Choose items to add to cart</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="status-online">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Stock Live</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <svg
              className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-3 rounded-xl whitespace-nowrap font-medium transition-all duration-300 transform hover:scale-105 ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="auto-grid">
        {loading ? (
          // Loading skeletons
          Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="card p-6">
              <div className="skeleton h-16 w-16 rounded-full mx-auto mb-4"></div>
              <div className="skeleton h-4 w-3/4 mx-auto mb-2"></div>
              <div className="skeleton h-3 w-full mb-3"></div>
              <div className="skeleton h-6 w-1/2 mx-auto mb-4"></div>
              <div className="skeleton h-10 w-full rounded-lg"></div>
            </div>
          ))
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No products found
            </h3>
            <p className="text-gray-500">Try adjusting your search criteria</p>
          </div>
        ) : (
          filteredProducts.map((product, index) => (
            <div
              key={product.id}
              className="card card-hover p-6 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="text-center">
                <div className="text-5xl mb-4 group-hover:animate-bounce-once">
                  {product.image}
                </div>
                <h3 className="font-bold text-lg text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {product.description}
                </p>

                <div className="flex items-center justify-between mb-4">
                  <div className="text-left">
                    <div className="text-2xl font-bold text-gradient-success">
                      ${product.price.toFixed(2)}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        product.stock > 10
                          ? 'text-green-600'
                          : product.stock > 5
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {product.stock > 0
                        ? `${product.stock} in stock`
                        : 'Out of stock'}
                    </div>
                  </div>
                  <div
                    className={`badge ${
                      product.stock > 10
                        ? 'badge-success'
                        : product.stock > 5
                        ? 'badge-warning'
                        : 'badge-danger'
                    }`}
                  >
                    {product.category}
                  </div>
                </div>

                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={product.stock === 0 || addingToCart === product.id}
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed ${
                    product.stock === 0
                      ? 'bg-gray-200 text-gray-500'
                      : addingToCart === product.id
                      ? 'bg-blue-400 text-white cursor-wait'
                      : 'btn-primary'
                  }`}
                >
                  {addingToCart === product.id ? (
                    <div className="flex items-center justify-center space-x-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="opacity-25"
                        ></circle>
                        <path
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          className="opacity-75"
                        ></path>
                      </svg>
                      <span>Adding...</span>
                    </div>
                  ) : product.stock === 0 ? (
                    'Out of Stock'
                  ) : (
                    <div className="flex items-center justify-center space-x-2">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      <span>Add to Cart</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Product Stats */}
      <div className="card p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {demoProducts.length}
            </div>
            <div className="text-sm text-gray-600">Total Products</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {demoProducts.filter((p) => p.stock > 0).length}
            </div>
            <div className="text-sm text-gray-600">In Stock</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {categories.length - 1}
            </div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {filteredProducts.length}
            </div>
            <div className="text-sm text-gray-600">Showing</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductGrid;
