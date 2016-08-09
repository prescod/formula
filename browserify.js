if (typeof window === 'object' && typeof window.formula === 'undefined') {
  window.formula = require('./lib/compiler')
}
