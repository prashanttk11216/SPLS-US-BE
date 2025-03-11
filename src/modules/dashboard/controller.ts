import { Request, Response } from "express";
import { LoadModel } from "../load/model";
import send from "../../utils/apiResponse";
import { RoleModel } from "../role/model";
import { UserModel } from "../user/model";
import { DispatchModel } from "../dispatch/model";
import { DispatchLoadStatus } from "../../enums/DispatchLoadStatus";
import { IUser } from "../../types/User";
import { UserRole } from "../../enums/UserRole";
import { TruckModal } from "../trucks/model";

export const getBrokerDashboardStats = async (
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

    console.log(filter);

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

    // const roleCounts = await RoleModel.find({});
    // const userRoleStats = await Promise.all(
    //   roleCounts.map(async (role) => {
    //     const count = await UserModel.countDocuments({
    //       roles: role._id,
    //       ...filter,
    //     });
    //     return { role: role.name, count };
    //   })
    // );

    const roleCounts = await RoleModel.find({});
    let filteredRoles = roleCounts;

    // If the user is a broker_user, filter out roles other than carrier and customer
    if (user?.roles.some((role) => role.name === UserRole.BROKER_USER)) {
      filteredRoles = roleCounts.filter((role) =>
        [UserRole.CARRIER, UserRole.CUSTOMER].includes(role.name as UserRole)
      );
    }

    const userRoleStats = await Promise.all(
      filteredRoles.map(async (role) => {
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

export const getCustomerDashboardStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    if (!user) {
      send(res, 401, "Unauthorized");
      return;
    }

    let filter = {};

    // If the logged-in user is a customer, filter loads posted by them
    if (user.roles.some((role) => role.name === UserRole.CUSTOMER)) {
      filter = { customerId: user._id };
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

    // Get total loads count
    const totalLoads = await LoadModel.countDocuments(filter);

    // Count active (ongoing) vs completed loads
    const activeLoads = await DispatchModel.countDocuments({
      ...filter,
      status: { $in: [DispatchLoadStatus.Published, DispatchLoadStatus.InTransit, DispatchLoadStatus.Delivered]},
    });

    const completedLoads = await DispatchModel.countDocuments({
      ...filter,
      status: { $in: [DispatchLoadStatus.Completed, DispatchLoadStatus.Invoiced, DispatchLoadStatus.InvoicedPaid]},
    });

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

    send(res, 200, "retrieved successfully", {
      loadStats,
      dispatchLoadStats,
      totalLoads,
      activeLoads,
      completedLoads,
    });
  } catch (error) {
    send(res, 500, "Server error");
  }
};

export const getCarrierDashboardStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    if (!user) {
      send(res, 401, "Unauthorized");
      return;
    }

    let filter = {};

    // If the logged-in user is a carrier, filter loads assigned to them
    if (user.roles.some((role) => role.name === UserRole.CARRIER)) {
      filter = { carrierId: user._id };
    }

    // Get load stats for carrier
    const dispatchStatuses = Object.values(DispatchLoadStatus).filter(
      (status) =>
        ![
          DispatchLoadStatus.Draft,
          DispatchLoadStatus.Invoiced,
          DispatchLoadStatus.InvoicedPaid,
        ].includes(status)
    );
    const dispatchLoadStats = await Promise.all(
      dispatchStatuses.map(async (status) => {
        const count = await DispatchModel.countDocuments({
          status,
          ...filter,
        });
        return { status, count };
      })
    );

    // Get active vs completed loads
    const activeLoads = await DispatchModel.countDocuments({
      ...filter,
      status: {
        $in: [DispatchLoadStatus.Published, DispatchLoadStatus.InTransit, DispatchLoadStatus.Delivered],
      },
    });

    const completedLoads = await DispatchModel.countDocuments({
      ...filter,
      status: {
        $in: [DispatchLoadStatus.Completed, DispatchLoadStatus.Invoiced, DispatchLoadStatus.InvoicedPaid]
      },
    });

    // Get truck listing stats
    const totalTrucks = await TruckModal.countDocuments({ postedBy: user._id });

    // Calculate earnings if applicable
    const invoicedPaidStats = await DispatchModel.aggregate([
      {
        $match: { status: DispatchLoadStatus.Invoiced, ...filter },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$carrierFee.totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const totalEarnings =
      invoicedPaidStats.length > 0 ? invoicedPaidStats[0].totalEarnings : 0;

    send(res, 200, "retrieved successfully", {
      dispatchLoadStats,
      activeLoads,
      completedLoads,
      totalTrucks,
      totalEarnings,
    });
  } catch (error) {
    send(res, 500, "Server error");
  }
};
