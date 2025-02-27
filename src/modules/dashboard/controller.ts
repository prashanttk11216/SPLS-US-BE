import { Request, Response } from "express";
import { LoadModel } from "../load/model";
import send from "../../utils/apiResponse";
import { RoleModel } from "../role/model";
import { UserModel } from "../user/model";
import { DispatchModel } from "../dispatch/model";
import { DispatchLoadStatus } from "../../enums/DispatchLoadStatus";
import { IUser } from "../../types/User";
import { UserRole } from "../../enums/UserRole";

export const getDashboardStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    let filter = {};
    if (user?.roles.some((role) => role.name === UserRole.BROKER_USER)) {
      filter = { postedBy: user._id };
    }

    const statuses = [
      "Draft",
      "Published",
      "Pending Response",
      "Deal Closed",
      "Cancelled",
    ];
    
    const loadStats = await Promise.all(
      statuses.map(async (status) => {
        const count = await LoadModel.countDocuments({
          status,
          ...filter,
        });
        return { status, count };
      })
    );
    const dispatchStatuses = Object.values(DispatchLoadStatus);
    const dispatchLoadStats = await Promise.all(
      dispatchStatuses.map(async (status) => {
        const count = await DispatchModel.countDocuments({
          status,
          ...filter,
        });
        return { status, count };
      })
    );

    const invoicedPaidStats = await DispatchModel.aggregate([
      {
        $match: { status: DispatchLoadStatus.InvoicedPaid, ...filter },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$allInRate" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalEarnings =
      invoicedPaidStats.length > 0 ? invoicedPaidStats[0].totalEarnings : 0;

    const roleCounts = await RoleModel.find({});
    const userRoleStats = await Promise.all(
      roleCounts.map(async (role) => {
        const count = await UserModel.countDocuments({
          roles: role._id,
          ...filter,
        });
        return { role: role.name, count };
      })
    );

    send(res, 200, "retrieved successfully", {
      loadStats,
      userRoleStats,
      dispatchLoadStats,
      totalEarnings,
    });
  } catch (error) {
    send(res, 500, "Server error");
  }
};
