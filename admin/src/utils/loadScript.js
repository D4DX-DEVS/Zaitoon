export const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${src}"]`)

    if (existingScript) {
      if (existingScript.getAttribute('data-loaded') === 'true') {
        resolve(true)
        return
      }

      existingScript.addEventListener('load', () => resolve(true))
      existingScript.addEventListener('error', () => reject(new Error('Failed to load script')))
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => {
      script.setAttribute('data-loaded', 'true')
      resolve(true)
    }
    script.onerror = () => reject(new Error(`Failed to load script ${src}`))
    document.body.appendChild(script)
  })
}

