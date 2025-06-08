// helpers.js
module.exports = {
  formatDate: function(date) {
    return new Date(date).toLocaleDateString();
  },
  excerpt: function(text, length) {
    if (!text) return '';
    if (text.length > length) {
      return text.substring(0, length - 3) + '...';
    }
    return text;
  }
};
