const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    timeline: './src/popup.js', // Rename entry point key for clarity
    // background: './src/background.js', // Entry point for the background script (if needed)
    // content: './src/content.js', // Entry point for content script (if needed)
  },
  output: {
    path: path.resolve(__dirname, '../ui/pages/timeline'),
    filename: '[name].bundle.js',
    clean: true, // Clean the dist folder before each build
  },
  mode: 'production', // Use production mode for optimized build without eval()
  module: {
    rules: [
      {
        test: /\.js$|\.jsx$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'postcss-loader', // Put config back inline
            options: {
              postcssOptions: {
                plugins: [
                  ['tailwindcss', { config: './tailwind.config.js' }], 
                  'autoprefixer',
                ],
              },
            },
          },
        ], // Process CSS files
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].bundle.css',
    }),
    new CopyPlugin({
      patterns: [
        { 
          from: 'public/index.html', 
          to: 'timeline.html',
          transform(content) {
            return content.toString().replace('popup.bundle.js', 'timeline.bundle.js');
          },
        },
        // Copy any other necessary assets from public if needed (e.g., actual icons)
        // { from: 'public/*.png', to: '.' } // Example if you add real icons later
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.jsx'], // Allow importing .js and .jsx files without specifying the extension
  },
  devtool: 'cheap-module-source-map', // Recommended source map type for extensions
}; 