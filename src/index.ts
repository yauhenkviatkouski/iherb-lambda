import { IherbService } from "./IHerbService";

type PostData = {
  link: string;
};

module.exports.main = async (data: PostData) => {
  const iHerbService = new IherbService();
  const products = await iHerbService.parseUri(data.link);
  console.log("Parsed products: ", products.length);
  return products;
};
