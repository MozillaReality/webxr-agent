const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  devtool: 'eval-source-map',
  entry: {
    'client': path.join(__dirname, '..', 'public', 'client.js'),
    'host': path.join(__dirname, '..', 'public', 'host.js')
  },
  output: {
    path: path.join(__dirname, '..', 'dist'),
    filename: '[name].js',
    publicPath: '/',
  },
  // plugins: [
  //   new HtmlWebpackPlugin({
  //     template: path.join(__dirname, '..', 'public', 'index.html'),
  //     inject: 'body',
  //     filename: 'index.html',
  //   }),
  // ],
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.jsx$/
      }
    ]
  }
};
