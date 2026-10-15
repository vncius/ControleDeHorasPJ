// Evita flash do tema errado antes do React montar. Fica num arquivo (e não
// inline no index.html) para a CSP de public/_headers não precisar de
// 'unsafe-inline' em script-src.
(function () {
  var t = null
  try {
    t = localStorage.getItem('horas-pj:tema')
  } catch (e) {}
  if (t !== 'dark' && t !== 'light') {
    t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  document.documentElement.setAttribute('data-theme', t)
})()
