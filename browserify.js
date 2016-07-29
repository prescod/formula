if (typeof window === 'object' && typeof window.FormulaFoundry === 'undefined') {
  window.FormulaFoundry = require('./lib/compiler')
}
