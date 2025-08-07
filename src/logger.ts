import winston, { format } from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(
    format.colorize({ all: true }),
    format.timestamp({
      format: "MM-DD HH:mm:ss",
    }),
    format.printf(
      (info) =>
        `${info.timestamp} [${info.level}]: ${info.message}` +
        (info.splat !== undefined ? `${info.splat}` : " "),
    ),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "./bot.log" }),
  ],
});

export const Triggerer = {
  Discord: "discord->github",
  Github: "github->discord",
};

export const Actions = {
  Created: "created",
  Closed: "closed",
  Commented: "commented",
  Reopened: "reopened",
  Locked: "locked",
  Unlocked: "unlocked",
  Deleted: "deleted",
  DeletedComment: "deleted comment",
} as const;

export type ActionValue = (typeof Actions)[keyof typeof Actions];