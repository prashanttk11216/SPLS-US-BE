import { Request, Response } from "express";
import { CommodityModel } from "./model";
import send from "../../../utils/apiResponse";

/**
 * Get all Commodities or a single Commodity based on the _id.
 */
export async function getCommodity(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const commodity = await CommodityModel.findOne({ _id });

      if (!commodity) {
        send(res, 404, "Commodity not found");
        return;
      }

      send(res, 200, "Retrieved successfully", commodity);
      return;
    }

    const commodityList = await CommodityModel.find();

    send(res, 200, "Commodities fetched successfully", commodityList);
  } catch (error) {
    console.error("Error fetching commodities:", error);
    send(res, 500, "Server error during commodity retrieval");
  }
}

/**
 * Create a new Commodity.
 */
export const createCommodity = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { label } = req.body;

    if (!label) {
      send(res, 400, "Label is required.");
      return;
    }

    const existingCommodity = await CommodityModel.findOne({ label });

    if (existingCommodity) {
      send(res, 409, "Commodity with this label already exists.");
      return;
    }

    const newCommodity = await CommodityModel.create({ label });

    send(res, 201, "Commodity created successfully.", newCommodity);
  } catch (error) {
    console.error("Error creating commodity:", error);
    send(res, 500, "Server error during commodity creation.");
  }
};

/**
 * Edit an existing Commodity.
 */
export const editCommodity = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { label } = req.body;

    if (!label) {
      send(res, 400, "Label is required to update the commodity.");
      return;
    }

    const updatedCommodity = await CommodityModel.findByIdAndUpdate(
      req.params.commodityId,
      { label },
      { new: true, runValidators: true }
    );

    if (!updatedCommodity) {
      send(res, 404, "Commodity not found.");
      return;
    }

    send(res, 200, "Commodity updated successfully.", updatedCommodity);
  } catch (error) {
    console.error("Error during commodity update:", error);
    send(res, 500, "Server error during commodity update.");
  }
};

/**
 * Delete Commodity.
 */
export const deleteCommodity = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const commodity = await CommodityModel.findByIdAndDelete(
      req.params.commodityId
    );

    if (!commodity) {
      send(res, 404, "Commodity not found.");
      return;
    }

    send(res, 200, "Commodity deleted successfully.");
  } catch (error) {
    console.error("Error during commodity deletion:", error);
    send(res, 500, "Server error during commodity deletion.");
  }
};
