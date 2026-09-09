/** 模拟网络延迟。不加这一层,loading 态永远不会被看到,
 *  学生也练不到「请求进行中」的 UI 处理。 */
export const delay = (min = 200, max = 500): Promise<void> => {
  const ms = min + Math.floor(Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}
