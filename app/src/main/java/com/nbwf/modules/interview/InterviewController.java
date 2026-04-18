package com.nbwf.modules.interview;

import com.nbwf.common.annotation.RateLimit;
import com.nbwf.common.result.Result;
import com.nbwf.modules.interview.model.*;
import com.nbwf.modules.interview.service.InterviewHistoryService;
import com.nbwf.modules.interview.service.InterviewPersistenceService;
import com.nbwf.modules.interview.service.InterviewSessionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * 面试控制器
 * 提供模拟面试相关的API接口
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "模拟面试", description = "面试会话创建、问答交互与报告生成")
public class InterviewController {
    
    private final InterviewSessionService sessionService;
    private final InterviewHistoryService historyService;
    private final InterviewPersistenceService persistenceService;
    
    /**
     * 创建面试会话
     */
    @PostMapping("/api/interview/sessions")
    @RateLimit(dimension = RateLimit.Dimension.GLOBAL, count = 5)
    @RateLimit(dimension = RateLimit.Dimension.IP, count = 5)
    public Result<InterviewSessionDTO> createSession(@RequestBody CreateInterviewRequest request,
                                                     @AuthenticationPrincipal Long userId) {
        log.info("创建面试会话，题目数量: {}", request.questionCount());
        InterviewSessionDTO session = sessionService.createSession(request, userId);
        return Result.success(session);
    }
    
    /**
     * 获取会话信息
     */
    @GetMapping("/api/interview/sessions/{sessionId}")
    public Result<InterviewSessionDTO> getSession(@PathVariable String sessionId,
                                                  @AuthenticationPrincipal Long userId) {
        InterviewSessionDTO session = sessionService.getSession(sessionId, userId);
        return Result.success(session);
    }
    
    /**
     * 获取当前问题
     */
    @GetMapping("/api/interview/sessions/{sessionId}/question")
    public Result<Map<String, Object>> getCurrentQuestion(@PathVariable String sessionId,
                                                          @AuthenticationPrincipal Long userId) {
        return Result.success(sessionService.getCurrentQuestionResponse(sessionId, userId));
    }
    
    /**
     * 提交答案
     */
    @PostMapping("/api/interview/sessions/{sessionId}/answers")
    @RateLimit(dimension = RateLimit.Dimension.GLOBAL, count = 10)
    public Result<SubmitAnswerResponse> submitAnswer(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Long userId) {
        Integer questionIndex = (Integer) body.get("questionIndex");
        String answer = (String) body.get("answer");
        log.info("提交答案: 会话{}, 问题{}", sessionId, questionIndex);
        SubmitAnswerRequest request = new SubmitAnswerRequest(sessionId, questionIndex, answer);
        SubmitAnswerResponse response = sessionService.submitAnswer(request, userId);
        return Result.success(response);
    }
    
    /**
     * 生成面试报告
     */
    @GetMapping("/api/interview/sessions/{sessionId}/report")
    public Result<InterviewReportDTO> getReport(@PathVariable String sessionId,
                                                @AuthenticationPrincipal Long userId) {
        log.info("生成面试报告: {}", sessionId);
        InterviewReportDTO report = sessionService.generateReport(sessionId, userId);
        return Result.success(report);
    }
    
    /**
     * 查找未完成的面试会话
     * GET /api/interview/sessions/unfinished/{resumeId}
     */
    @GetMapping("/api/interview/sessions/unfinished/{resumeId}")
    public Result<InterviewSessionDTO> findUnfinishedSession(@PathVariable Long resumeId,
                                                             @AuthenticationPrincipal Long userId) {
        return Result.success(sessionService.findUnfinishedSessionOrThrow(resumeId, userId));
    }
    
    /**
     * 暂存答案（不进入下一题）
     */
    @PutMapping("/api/interview/sessions/{sessionId}/answers")
    public Result<Void> saveAnswer(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal Long userId) {
        Integer questionIndex = (Integer) body.get("questionIndex");
        String answer = (String) body.get("answer");
        log.info("暂存答案: 会话{}, 问题{}", sessionId, questionIndex);
        SubmitAnswerRequest request = new SubmitAnswerRequest(sessionId, questionIndex, answer);
        sessionService.saveAnswer(request, userId);
        return Result.success(null);
    }
    
    /**
     * 提前交卷
     */
    @PostMapping("/api/interview/sessions/{sessionId}/complete")
    public Result<Void> completeInterview(@PathVariable String sessionId,
                                          @AuthenticationPrincipal Long userId) {
        log.info("提前交卷: {}", sessionId);
        sessionService.completeInterview(sessionId, userId);
        return Result.success(null);
    }
    
    /**
     * 获取面试会话详情
     * GET /api/interview/sessions/{sessionId}/details
     */
    @GetMapping("/api/interview/sessions/{sessionId}/details")
    public Result<InterviewDetailDTO> getInterviewDetail(@PathVariable String sessionId,
                                                         @AuthenticationPrincipal Long userId) {
        InterviewDetailDTO detail = historyService.getInterviewDetail(sessionId, userId);
        return Result.success(detail);
    }
    
    /**
     * 导出面试报告为PDF
     */
    @GetMapping("/api/interview/sessions/{sessionId}/export")
    public ResponseEntity<byte[]> exportInterviewPdf(@PathVariable String sessionId,
                                                     @AuthenticationPrincipal Long userId) {
        byte[] pdfBytes = historyService.exportInterviewPdf(sessionId, userId);
        String filename = URLEncoder.encode("模拟面试报告_" + sessionId + ".pdf",
            StandardCharsets.UTF_8);

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + filename)
            .contentType(MediaType.APPLICATION_PDF)
            .body(pdfBytes);
    }
    
    /**
     * 删除面试会话
     */
    @DeleteMapping("/api/interview/sessions/{sessionId}")
    public Result<Void> deleteInterview(@PathVariable String sessionId,
                                        @AuthenticationPrincipal Long userId) {
        log.info("删除面试会话: {}", sessionId);
        persistenceService.deleteSessionBySessionId(sessionId, userId);
        return Result.success(null);
    }
}
