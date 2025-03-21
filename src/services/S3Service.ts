// import {
//   S3Client,
//   PutObjectCommand,
//   GetObjectCommand,
//   DeleteObjectCommand,
//   ListObjectsV2Command,
// } from "@aws-sdk/client-s3";
// import { readFileSync, writeFileSync } from "fs-extra";
// import { streamToBuffer } from "../utils/globalHelper";

// class S3Service {
//   private s3Client: S3Client;

//   constructor() {
//     const config = {
//       // Configure region and credentials appropriately
//       region: "your-aws-region",
//       credentials: {
//         accessKeyId: "YOUR_ACCESS_KEY_ID",
//         secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
//       },
//     };
//     this.s3Client = new S3Client(config);
//   }

//   async uploadFile(key: string, filePath: string): Promise<void> {
//     const params = {
//       Bucket: "<Your S3 Bucket Name>",
//       Key: key,
//       Body: readFileSync(filePath),
//     };

//     try {
//       await this.s3Client.send(new PutObjectCommand(params));
//       console.log(`File uploaded successfully to ${key}`);
//     } catch (error) {
//       console.error("Error uploading file:", error);
//       throw error;
//     }
//   }

//   async downloadFile(key: string, localFilePath: string): Promise<void> {
//     const params = {
//       Bucket: "<Your S3 Bucket Name>",
//       Key: key,
//     };

//     try {
//       const data = await this.s3Client.send(new GetObjectCommand(params));
//       if (data.Body) {
//         // Convert to Buffer
//         const buffer = Buffer.from(await streamToBuffer(data.Body));
//         writeFileSync(localFilePath, buffer);
//         console.log(`File downloaded successfully to ${localFilePath}`);
//       } else {
//         console.log("Object not found in S3.");
//       }
//     } catch (error) {
//       console.error("Error downloading file:", error);
//       throw error;
//     }
//   }

//   async deleteFile(key: string): Promise<void> {
//     const params = {
//       Bucket: "<Your S3 Bucket Name>",
//       Key: key,
//     };

//     try {
//       await this.s3Client.send(new DeleteObjectCommand(params));
//       console.log(`File deleted successfully`);
//     } catch (error) {
//       console.error("Error deleting file:", error);
//       throw error;
//     }
//   }

//   async listObjects(prefix: string): Promise<string[]> {
//     const params = {
//       Bucket: "<Your S3 Bucket Name>",
//       Prefix: prefix,
//     };

//     try {
//       const data = await this.s3Client.send(new ListObjectsV2Command(params));
//       return data.Contents?.map((obj) => obj.Key!) || [];
//     } catch (error) {
//       console.error("Error listing objects:", error);
//       throw error;
//     }
//   }
// }

// export default S3Service;
