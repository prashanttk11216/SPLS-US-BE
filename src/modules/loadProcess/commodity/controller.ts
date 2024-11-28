import { Request, Response } from "express";
import { CommodityModel } from "./model"; // Import CommodityModel

/**
 * Get all Commodities or a single Commodity based on the _id.
 */
export async function getCommodity(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const commodity = await CommodityModel.findOne({ _id });

      if (!commodity) {
        res.status(404).json({ message: "Commodity not found" });
        return;
      }

      res
        .status(200)
        .json({ message: "Retrieved successfully", data: commodity });
      return;
    }

    // Fetch all commodities without pagination or sorting
    const commodityList = await CommodityModel.find();

    res
      .status(200)
      .json({
        message: "Commodities fetched successfully",
        data: commodityList,
      });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
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
    const { label } = req.body; // Destructure the label from the request body

    // Validate the incoming data
    if (!label) {
      res.status(400).json({ message: "Label is required." });
      return;
    }

    // Check for duplicate label (if the label should be unique)
    const existingCommodity = await CommodityModel.findOne({ label });

    if (existingCommodity) {
      res
        .status(409)
        .json({ message: "Commodity with this label already exists." });
      return;
    }

    // Create new Commodity with the label
    const newCommodity = await CommodityModel.create({ label });

    // Return response
    res.status(201).json({
      message: "Commodity created successfully.",
      data: newCommodity,
    });
  } catch (error) {
    console.error("Error creating commodity:", error);
    res
      .status(500)
      .json({ message: "Server error during commodity creation." });
  }
};


/** *for Adding Multiple data in one go 
* Create multiple pieces of Commodities. */

// export const createCommodity = async (
//     req: Request,
//     res: Response
//   ): Promise<void> => {
//     try {
//       const { commodityList } = req.body; // Expecting an array of commodity objects
  
//       // Validate the incoming data
//       if (!Array.isArray(commodityList) || commodityList.length === 0) {
//         res.status(400).json({
//           message: "Commodity list is required and should be a non-empty array.",
//         });
//         return;
//       }
  
//       // Check for duplicates in the provided list and existing database records
//       const labels = commodityList.map((commodity) => commodity.label);
//       const existingCommodities = await CommodityModel.find({
//         label: { $in: labels },
//       });
  
//       if (existingCommodities.length > 0) {
//         const existingLabels = existingCommodities.map(
//           (commodity) => commodity.label
//         );
//         res.status(409).json({
//           message: "Some commodities already exist.",
//           existingLabels,
//         });
//         return;
//       }
  
//       // Insert all commodities in one operation
//       const newCommodities = await CommodityModel.insertMany(commodityList);
  
//       // Return the created commodities
//       res.status(201).json({
//         message: "Commodities created successfully.",
//         data: newCommodities,
//       });
//     } catch (error) {
//       console.error("Error creating commodities:", error);
//       res.status(500).json({
//         message: "Server error during commodity creation.",
//       });
//     }
//   };

  
/**
 * Edit an existing Commodity.
 */
export const editCommodity = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { label } = req.body; // Destructure only the label field from the request body

    // Validate the label field (if required)
    if (!label) {
      res
        .status(400)
        .json({ message: "Label is required to update the commodity." });
      return;
    }

    // Find and update the commodity
    const updatedCommodity = await CommodityModel.findByIdAndUpdate(
      req.params.commodityId,
      { label }, // Only update the label field
      { new: true, runValidators: true } // Ensure new data is returned and validators are applied
    );

    if (!updatedCommodity) {
      res.status(404).json({ message: "Commodity not found." });
      return;
    }

    res.status(200).json({
      message: "Commodity updated successfully.",
      data: updatedCommodity,
    });
  } catch (error) {
    console.error("Error during commodity update:", error);
    res.status(500).json({ message: "Server error during commodity update." });
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
    // Delete the commodity by _id
    const commodity = await CommodityModel.findByIdAndDelete(
      req.params.commodityId
    );

    if (!commodity) {
      res.status(404).json({ message: "Commodity not found." });
      return;
    }

    res.status(200).json({ message: "Commodity deleted successfully." });
  } catch (error) {
    console.error("Error during commodity deletion:", error);
    res
      .status(500)
      .json({ message: "Server error during commodity deletion." });
  }
};
