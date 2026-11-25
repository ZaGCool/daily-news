// src/inngest/functions.ts
// 导入在 client.ts 中创建的 Inngest 客户端实例。
// 后续通过这个实例注册函数，并让它使用相同的应用 ID 和配置。
import { inngest } from "./client";
import { generateDailyDigest } from "../../lib/rss_utils";
import { Resend } from "resend";

// 调用客户端的 createFunction 方法，创建并注册一个名为 processTask 的后台任务。
// Inngest 会根据下面的配置识别、分发、重试和恢复这个任务。
export const processTask = inngest.createFunction(
  // 第一个参数是函数的配置对象，用于描述任务的名称和触发方式。
  {
    // 函数的唯一内部标识；最终可能与客户端 ID 一起组成 fnId，例如 my-app-process-task。
    id: "process-task",

    // 该任务的触发器配置。
    // 当应用发送 app/task.created 事件时，Inngest 会自动执行这个函数。
    triggers: { event: "app/task.created" },
  },

  // 第二个参数是任务真正执行的异步处理函数。
  // Inngest 会把事件内容和一组 step 步骤工具注入到这个回调中。
  async ({ event, step }) => {
    // 使用 step.run 定义一个可持久化执行的步骤。
    // 第一个参数 "handle-task" 是步骤的唯一名称；不要在同一函数中重复使用它。
    // 第二个参数是实际要执行的异步工作。
    const result = await step.run("handle-task", async () => {
      // 将任务标记为已处理，并返回任务的处理结果。
      // event.data 是触发事件时传入的数据；这里读取其中的 id 字段。
      // 这个结果会被 Inngest 保存，并赋值给外部的 result 常量。
      return { processed: true, id: event.data.id };
    });

    // 使用 step.sleep 定义一个可恢复的休眠步骤。
    // 第一个参数 "pause" 是休眠步骤的唯一名称。
    // 第二个参数 "1s" 表示休眠一秒钟；示例中常用于模拟后续处理或延迟流程。
    // 休眠期间不会永久占用 Next.js 的工作进程，稍后由 Inngest 再次唤醒执行。
    await step.sleep("pause", "1s");

    // 所有步骤执行完毕后，返回任务最终结果。
    // message 中使用事件携带的任务 ID，方便日志、控制台或调用方识别任务。
    // result 是 step.run 保存并返回的对象：包含 processed 和 id 字段。
    return { message: `Task ${event.data.id} complete`, result };
  },
);

export const sendDailyEmail = inngest.createFunction(
  {
    id: "send-daily-email",
    // triggers: { event: "app/daily.email" },
    // 使用 cron 触发器，每天 16:32（北京时间）执行一次。
    triggers: { cron: "15 11 * * *", timezone: "Asia/Beijing" },
  },
  async ({ step }) => {
    // 使用 step.run 定义一个可持久化执行的步骤，生成每日新闻摘要。
    const result = await step.run("generateDailyDigest", async () => {
      return await generateDailyDigest();
    });

    // 使用 Resend API 创建并发送每日新闻摘要邮件。
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 使用 Resend Broadcast 按 segmentId 定向发送给分组中的每一个邮箱。
    const email = await step.run("send-daily-news-email", async () => {
      // const { data, error } = await resend.emails.send({
      //   from: "Daily News <onboarding@resend.dev>",
      //   to: "myzagzach@gmail.com",
      //   subject: "今日科技新闻摘要",
      //   html: result.html,
      //   text: result.summary,
      // });

      const { data, error } = await resend.broadcasts.create({
        name: `每日科技新闻摘要 - ${new Date().toISOString().slice(0, 10)}`,
        previewText: "今日科技重点新闻摘要",
        segmentId: "2afb601d-4f1c-4269-8a0b-77c465ab3569",
        from: "Daily News <zag@zagcool.com>",
        subject: "今日科技新闻摘要",
        html: result.html,
        text: result.summary,
        send: true,
      });

      if (error) {
        throw new Error(`创建或发送每日摘要失败：${error.message}`);
      }

      if (!data) {
        throw new Error("创建每日摘要广播成功，但未返回广播 ID。");
      }

      return data;
    });
    // 返回发送结果，包含广播 ID 和状态。
    return { message: `每日新闻摘要已发送，广播 ID: ${email.id}`, email };
  },
);
