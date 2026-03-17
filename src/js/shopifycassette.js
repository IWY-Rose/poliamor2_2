(function () {
    var scriptURL = 'https://sdks.shopifycdn.com/buy-button/latest/buy-button-storefront.min.js';
    if (window.ShopifyBuy) {
      if (window.ShopifyBuy.UI) {
        ShopifyBuyInit();
      } else {
        loadScript();
      }
    } else {
      loadScript();
    }
    function loadScript() {
      var script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = scriptURL;
      (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(script);
      script.onload = ShopifyBuyInit;
    }
    function ShopifyBuyInit() {
      var client = ShopifyBuy.buildClient({
        domain: '0xzujc-1t.myshopify.com',
        storefrontAccessToken: 'dcb71369523740912239b6173399a6e0',
      });
      ShopifyBuy.UI.onReady(client).then(function (ui) {
        ui.createComponent('product', {
          id: '9484561580261',
          node: document.getElementById('product-component-1773719733580'),
          moneyFormat: '%24%7B%7Bamount_no_decimals%7D%7D',
          options: {
            "product": {
              "styles": {
                "product": {
                  "@media (min-width: 601px)": {
                    "max-width": "100%",
                    "margin-left": "0",
                    "margin-bottom": "50px"
                  },
                  "text-align": "left"
                },
                "title": { "font-size": "26px" },
                "button": {
                  "font-size": "17px",
                  "padding-top": "16.5px",
                  "padding-bottom": "16.5px",
                  ":hover": { "background-color": "#4e65a4" },
                  "background-color": "#5770b6",
                  ":focus": { "background-color": "#4e65a4" },
                  "border-radius": "0px",
                  "padding-left": "99px",
                  "padding-right": "99px"
                },
                "quantityInput": {
                  "font-size": "17px",
                  "padding-top": "16.5px",
                  "padding-bottom": "16.5px"
                },
                "price": { "font-size": "18px" },
                "compareAt": { "font-size": "15.3px" },
                "unitPrice": { "font-size": "15.3px" }
              },
              "layout": "horizontal",
              "contents": {
                "img": false,
                "imgWithCarousel": true,
                "description": true
              },
              "width": "100%",
              "text": { "button": "Add to cart" }
            },
            "productSet": {
              "styles": {
                "products": {
                  "@media (min-width: 601px)": { "margin-left": "-20px" }
                }
              }
            },
            "modalProduct": {
              "contents": {
                "img": false,
                "imgWithCarousel": true,
                "button": false,
                "buttonWithQuantity": true
              },
              "styles": {
                "product": {
                  "@media (min-width: 601px)": {
                    "max-width": "100%",
                    "margin-left": "0px",
                    "margin-bottom": "0px"
                  }
                },
                "button": {
                  "font-size": "17px",
                  "padding-top": "16.5px",
                  "padding-bottom": "16.5px",
                  ":hover": { "background-color": "#4e65a4" },
                  "background-color": "#5770b6",
                  ":focus": { "background-color": "#4e65a4" },
                  "border-radius": "0px",
                  "padding-left": "99px",
                  "padding-right": "99px"
                },
                "quantityInput": {
                  "font-size": "17px",
                  "padding-top": "16.5px",
                  "padding-bottom": "16.5px"
                },
                "title": {
                  "font-family": "Helvetica Neue, sans-serif",
                  "font-weight": "bold",
                  "font-size": "26px",
                  "color": "#4c4c4c"
                },
                "price": {
                  "font-family": "Helvetica Neue, sans-serif",
                  "font-weight": "normal",
                  "font-size": "18px",
                  "color": "#4c4c4c"
                },
                "compareAt": {
                  "font-family": "Helvetica Neue, sans-serif",
                  "font-weight": "normal",
                  "font-size": "15.3px",
                  "color": "#4c4c4c"
                },
                "unitPrice": {
                  "font-family": "Helvetica Neue, sans-serif",
                  "font-weight": "normal",
                  "font-size": "15.3px",
                  "color": "#4c4c4c"
                }
              },
              "text": { "button": "Add to cart" }
            },
            "option": {},
            "cart": {
              "styles": {
                "button": {
                  "font-size": "17px",
                  "padding-top": "16.5px",
                  "padding-bottom": "16.5px",
                  ":hover": { "background-color": "#4e65a4" },
                  "background-color": "#5770b6",
                  ":focus": { "background-color": "#4e65a4" },
                  "border-radius": "0px"
                }
              },
              "text": { "total": "Subtotal", "button": "Checkout" },
              "popup": false
            },
            "toggle": {
              "styles": {
                "toggle": {
                  "background-color": "#5770b6",
                  ":hover": { "background-color": "#4e65a4" },
                  ":focus": { "background-color": "#4e65a4" }
                },
                "count": { "font-size": "17px" }
              }
            }
          },
        });
      });
    }
  })();