// get correct viewport height
let vh = window.innerHeight * 0.01
document.documentElement.style.setProperty("--vh", `${vh}px`)

// accordions

var acc = document.getElementsByClassName("js-accordion__header")

for (let i = 0; i < acc.length; i++) {
  acc[i].addEventListener("click", function () {
    this.classList.toggle("active")
    var panel = this.nextElementSibling
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px"
    }
  })
}

var ticketAcc = document.getElementsByClassName("js-accordion__header--tickets")

for (let i = 0; i < ticketAcc.length; i++) {
  ticketAcc[i].addEventListener("click", function () {
    this.classList.toggle("active")
    var panel = this.parentElement.querySelector(
      ".js-accordion__content--tickets"
    )
    if (panel.style.maxHeight) {
      panel.style.maxHeight = null
    } else {
      panel.style.maxHeight = panel.scrollHeight + "px"
    }
  })
}

// buttons

function disableButton(el) {
  el.disabled = true
}

function enableButton(el) {
  el.disabled = false
}

// number stepper

var event = new Event("input")

function attachNumStepper(el) {
  const numStepperInput = el.querySelector("input")
  const numStepperButtons = el.querySelectorAll("button")
  const selectButton = el.parentElement.querySelector(".js-stepper-controlled")
  const min = parseInt(numStepperInput.getAttribute("min"), 10)
  let max = parseInt(numStepperInput.getAttribute("max"), 10)

  numStepperButtons.forEach(button => {
    button.addEventListener("click", () => {
      let tempValue = parseInt(numStepperInput.value, 10)
      let newValue = parseInt(numStepperInput.value, 10)
      let thisAction = button.getAttribute("data-num-step")
      max = parseInt(numStepperInput.getAttribute("max"))

      if (typeof tempValue === "number" && isNaN(tempValue)) {
        newValue = min
        numStepperInput.value = newValue
      } else {
        if (thisAction === "up") {
          newValue = newValue + 1
        }
        if (thisAction === "down") {
          newValue = newValue - 1
        }
        newValue = Math.min(Math.max(newValue, min), max)
        numStepperInput.value = newValue
        numStepperInput.dispatchEvent(event)
      }

      if (selectButton) {
        if (numStepperInput.value > 0) {
          enableButton(selectButton)
        } else {
          disableButton(selectButton)
        }
      }
    })
  })
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".js-number-stepper").forEach(attachNumStepper)
})

// adult count dropdowns
function attachDropdown(el) {
  const dropdownInput = el.querySelector(".js-dropdown-input")
  const dropdownCount = el.querySelector(".js-dropdown-count")
  const dropdownButtons = el.querySelectorAll(".js-toggle-dropdown")
  const dropdownOptionsOuter = el.querySelector(".js-dropdown-options")
  const dropdownOptions = el.querySelectorAll(".js-dropdown-option")
  const selectButton = el.parentElement.querySelector(".js-stepper-controlled")

  dropdownOptions.forEach(option => {
    option.addEventListener("click", () => {
      const optionValue = parseInt(option.dataset.value, 10)
      dropdownInput.value = optionValue
      dropdownCount.innerHTML = optionValue
      dropdownOptionsOuter.hidden = true

      if (dropdownInput.value > 0) {
        enableButton(selectButton)
      } else {
        disableButton(selectButton)
      }
    })
  })

  dropdownButtons.forEach(dropdownButton => {
    dropdownButton.addEventListener("click", () => {
      const dropdownState = dropdownOptionsOuter.hidden
      if (dropdownState == true) {
        dropdownOptionsOuter.hidden = false
      } else dropdownOptionsOuter.hidden = true
    })
  })
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".js-dropdown").forEach(attachDropdown)
})

// set page scroll on submit

document.addEventListener("DOMContentLoaded", () => {
  const addToCartForms = Array.from(
    document.querySelectorAll("form[action='/sites/line-items']")
  )
  addToCartForms.forEach(form =>
    form.addEventListener("submit", () => {
      sessionStorage.setItem("position", document.documentElement.scrollTop)
    })
  )
})

// get page scroll

const position = sessionStorage.getItem("position")
const lastPageUrl = document.referrer
const currentUrl = window.location.href
if (position !== null && lastPageUrl == currentUrl) {
  window.scrollTo({
    top: parseInt(position, 10),
    behavior: "smooth",
  })
}
sessionStorage.removeItem("position")

// get heights
let rootSize = window
  .getComputedStyle(document.body)
  .getPropertyValue("font-size")
let rootNumber = parseFloat(rootSize)

let breadcrumbHeightRems = 0
function getBreadcrumbHeight() {
  const breadcrumbs = document.querySelector(".js-breadcrumbs")
  if (breadcrumbs) {
    const breadcrumbHeight = breadcrumbs.offsetHeight
    breadcrumbHeightRems = breadcrumbHeight / rootNumber
  }
}

let tabsHeightRems = 0
function getTabsHeight() {
  const tabs = document.querySelector(".js-tabs")
  if (tabs) {
    const tabsHeight = tabs.offsetHeight
    tabsHeightRems = tabsHeight / rootNumber
  }
}

// set sidebar position

function setSidebarTop() {
  const sidebar = document.querySelector(".js-sidebar-outer")
  document.documentElement.style.setProperty(
    "--breadcrumbs-height",
    `${breadcrumbHeightRems}rem`
  )
}

// toggle cart

function openCart(el) {
  const cart = document.querySelector(".js-cart-container")
  const customBlock = el.closest('.custom-block')
  const body = document.querySelector("body")

  el.dataset.active = "true"
  el.classList.add("active")
  cart.classList.add("active")
  cart.classList.add("was-mobile-cart")

  // Set z-index equal to navbar so this block (being a later sibling) 
  // will naturally layer above it in the DOM stacking context
  if (customBlock) {
    customBlock.style.zIndex = 'var(--navbar-position)'
  }

  body.classList.add("mobile-cart-open")
}

function closeCart(el) {
  const cart = document.querySelector(".js-cart-container")
  const body = document.querySelector("body")

  el.dataset.active = "false"
  el.classList.remove("active")
  cart.classList.remove("active")

  // Wait for opacity transition (0.2s = 200ms) to complete before removing mobile-cart-open class
  // This prevents the height animation from interfering with the opacity transition
  setTimeout(() => {
    body.classList.remove("mobile-cart-open") 
  }, 200) // Matches transition duration from CSS
}

function toggleCart(el) {
  const cartState = el.dataset.active
  if (cartState == "true") {
    closeCart(el)
  } else openCart(el)
}

document.addEventListener("DOMContentLoaded", () => {
  getBreadcrumbHeight()
  getTabsHeight()
  setSidebarTop()

  const toggleCartButtons = Array.from(
    document.querySelectorAll(".js-toggle-cart")
  )
  toggleCartButtons.forEach(button =>
    button.addEventListener("click", () => {
      toggleCart(button)
    })
  )

  const closeCartButtons = Array.from(
    document.querySelectorAll(".js-close-cart")
  )
  closeCartButtons.forEach(button =>
    button.addEventListener("click", () => {
      toggleCartButtons.forEach(button => closeCart(button))
    })
  )
})

// copy page url
const copyPageUrlButtons = Array.from(document.querySelectorAll(".js-copy-url"))

document.addEventListener("DOMContentLoaded", () => {
  copyPageUrlButtons.forEach(button =>
    button.addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href)
    })
  )
})

// get and set cookies
function setCookie(cname, cvalue, exdays) {
  const d = new Date()
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000)
  let expires = "expires=" + d.toUTCString()
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/"
}

function getCookie(cname) {
  let name = cname + "="
  let decodedCookie = decodeURIComponent(document.cookie)
  let ca = decodedCookie.split(";")
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) == " ") {
      c = c.substring(1)
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length)
    }
  }
  return ""
}
