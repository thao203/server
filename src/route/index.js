const ClearanceBooksRouter = require('./ClearanceBooksRouter');
function route(app) {
  // Route m?c ??nh ?? ki?m tra server
  app.get('/', (req, res) => {
    res.json({ message: 'Server is running' });
  });

  // G?n c�c router v�o base path
  app.use('/api/clearance-books', ClearanceBooksRouter); // Clearance Books
  // Middleware x? l� l?i 404 cho c�c route kh�ng t?n t?i
  app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });
}

module.exports = route;