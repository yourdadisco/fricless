import { agentTool } from './agent_tool.js';
import { askUserTool } from './ask_user.js';
import { bashTool } from './bash.js';
import { briefTool } from './brief.js';
import { calculatorTool } from './calculator.js';
import { codeRunTool } from './code_run.js';
import { configTool } from './config_tool.js';
import { dateTimeTool } from './datetime.js';
import { discoverSkillsTool } from './discover_skills.js';
import { echoTool } from './echo.js';
import { editFileTool } from './edit_file.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { hashTool } from './hash.js';
import { lspTool } from './lsp.js';
import { monitorTool } from './monitor.js';
import { notebookTool } from './notebook.js';
import { overflowTestTool } from './overflow_test.js';
import { planModeTool } from './plan_mode.js';
import { powershellTool } from './powershell.js';
import { readFileTool } from './read_file.js';
import { remoteTriggerTool } from './remote_trigger.js';
import { reviewArtifactTool } from './review_artifact.js';
import { scheduleCronTool } from './schedule_cron.js';
import { sendMessageTool } from './send_message.js';
import { sendUserFileTool } from './send_user_file.js';
import { skillTool } from './skill.js';
import { sleepTool } from './sleep.js';
import { snipTool } from './snip.js';
import { syntheticOutputTool } from './synthetic_output.js';
import { taskCreateTool } from './task_create.js';
import { taskGetTool } from './task_get.js';
import { taskListTool } from './task_list.js';
import { taskOutputTool } from './task_output.js';
import { taskStopTool } from './task_stop.js';
import { taskUpdateTool } from './task_update.js';
import { teamCreateTool } from './team_create.js';
import { teamDeleteTool } from './team_delete.js';
import { terminalCaptureTool } from './terminal_capture.js';
import { textSummarizeTool } from './text_summarize.js';
import { timeTool } from './time.js';
import { todoTool } from './todo.js';
import { toolSearchTool } from './tool_search.js';
import { translateTool } from './translate.js';
import { tungstenTool } from './tungsten.js';
import { uuidGenTool } from './uuid_gen.js';
import { verifyPlanTool } from './verify_plan.js';
import { webBrowserTool } from './web_browser.js';
import { webFetchTool } from './web_fetch.js';
import { webSearchTool } from './web_search.js';
import { workflowTool } from './workflow.js';
import { writeFileTool } from './write_file.js';
import type { AnyTool } from '../Tool.js';

export const builtinTools: AnyTool[] = [
  agentTool,
  askUserTool,
  bashTool,
  briefTool,
  calculatorTool,
  codeRunTool,
  configTool,
  dateTimeTool,
  discoverSkillsTool,
  echoTool,
  editFileTool,
  globTool,
  grepTool,
  hashTool,
  lspTool,
  monitorTool,
  notebookTool,
  overflowTestTool,
  planModeTool,
  powershellTool,
  readFileTool,
  remoteTriggerTool,
  reviewArtifactTool,
  scheduleCronTool,
  sendMessageTool,
  sendUserFileTool,
  skillTool,
  sleepTool,
  snipTool,
  syntheticOutputTool,
  taskCreateTool,
  taskGetTool,
  taskListTool,
  taskOutputTool,
  taskStopTool,
  taskUpdateTool,
  teamCreateTool,
  teamDeleteTool,
  terminalCaptureTool,
  textSummarizeTool,
  timeTool,
  todoTool,
  toolSearchTool,
  translateTool,
  tungstenTool,
  uuidGenTool,
  verifyPlanTool,
  webBrowserTool,
  webFetchTool,
  webSearchTool,
  workflowTool,
  writeFileTool,
];
