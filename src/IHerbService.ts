import axios from "axios";
import { JSDOM, VirtualConsole } from "jsdom";

const addBYtoUri = (uri: string): string => {
  return uri.replace(/.+iherb.com/g, "https://by.iherb.com");
};

type ParsedDocument = {
  rawHtml: string;
  type: "cart" | "showcase";
};

export type IherbProductInfo = {
  name: string;
  link: string;
  imageLink?: string;
  qty?: number;
  brand?: string;
  regularPrice?: number;
  superPrice?: number;
  isNotAvailable?: boolean;
};

export class IherbService {
  private async getHtmlPage(uri: string): Promise<ParsedDocument | null> {
    const proxyLink = "";
    const fixedUri = uri.includes("https://checkout") ? uri : addBYtoUri(uri);

    try {
      const { data, request } = await axios.get(fixedUri);
      const iherbUriType =
        (request.res.responseUrl.includes("iherb.com/cart/") && "cart") ||
        (request.res.responseUrl.includes("iherb.com/pr/") && "showcase") ||
        null;

      if (!iherbUriType) {
        return null;
      }
      return {
        type: iherbUriType,
        rawHtml: data,
      };
    } catch {
      return null;
    }
  }

  async parseUri(uri: string): Promise<IherbProductInfo[] | null> {
    const page = await this.getHtmlPage(uri);
    if (!page) {
      return null;
    }
    if (page.type === "cart") {
      const productsConcise = this.getProductsFromCart(page.rawHtml);
      return Promise.all(
        productsConcise.map(async (product) => {
          const productPage = await this.getHtmlPage(product.link);
          if (!productPage) {
            return {
              ...product,
              isNotAvailable: true,
            };
          }
          if (productPage.type !== "showcase") {
            return null;
          }
          return {
            ...this.getProductFromShowcase(productPage.rawHtml),
            link: product.link,
            qty: product.qty,
          };
        })
      );
    } else if (page.type === "showcase") {
      return [{ ...this.getProductFromShowcase(page.rawHtml), link: uri }];
    }
  }

  private getProductsFromCart(cartPageHtml: string) {
    const dom = new JSDOM(cartPageHtml, {
      virtualConsole: new VirtualConsole(),
    });
    const document = dom.window.document;
    const productRows = Array.from(
      document.querySelectorAll('[data-qa-element="product-cell"]')
    );
    return productRows.map((productRow) => {
      const linkElement = Array.from(productRow.querySelectorAll("a")).filter(
        (linkElement) =>
          linkElement.getAttribute("href")?.includes("iherb.com/pr/") &&
          linkElement.querySelector("div")
      )[0];

      const qty = Array.from(productRow.childNodes).filter((node) => {
        return node.nodeName === "DIV";
      })[3].firstChild.textContent;

      return {
        name: linkElement.firstChild.textContent,
        link: addBYtoUri(linkElement.getAttribute("href")),
        qty: Number(qty),
      };
    });
  }

  private getProductFromShowcase(showcasePageHtml: string) {
    const dom = new JSDOM(showcasePageHtml, {
      virtualConsole: new VirtualConsole(),
    });
    const document = dom.window.document;

    const brand =
      document.querySelector("#breadCrumbs").childNodes[3].textContent;
    const name = document
      .querySelector("#name")
      .textContent.replace(`${brand}, `, "");

    const regularPriceString = document
      .querySelector("#price")
      .textContent.replace(/\sBr/, "");

    const superPriceString = document
      .querySelector("#super-special-price")
      ?.querySelector("b")
      ?.textContent.replace(/Br/, "");

    const weight = document
      .querySelector("#product-specs-list")
      ?.querySelector(".product-weight")
      ?.textContent.replace(/\sкг/, "");

    const imageLink = document
      .querySelector("#iherb-product-image")
      .getAttribute("src");

    return {
      name: name.charAt(0).toLocaleUpperCase() + name.slice(1),
      brand,
      regularPrice: Math.round(Number(regularPriceString) * 100),
      superPrice: Math.round(Number(superPriceString) * 100) || null,
      weight: Number(weight),
      imageLink,
    };
  }
}
