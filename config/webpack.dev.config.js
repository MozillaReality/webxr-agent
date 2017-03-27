const path = require('path');

const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  devtool: 'eval-source-map',
  entry: {
    // 'hot-middleware': 'webpack-hot-middleware/client?reload=true',
    'client': path.join(__dirname, '..', 'public', 'client.js'),
    'host': path.join(__dirname, '..', 'public', 'host.js')
  },
  output: {
    path: path.join(__dirname, '..', 'dist'),
    filename: '[name].js',
    // publicPath: '/',
  },
  plugins: [
    // new HtmlWebpackPlugin({
    //   template: path.join(__dirname, '..', 'public', 'index.html'),
    //   inject: 'body',
    //   filename: 'index.html',
    // }),
    // new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
  ],
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.jsx$/
      }
    ]
  }
};
