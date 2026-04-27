package com.nbwf.modules.job.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.model.*;
import com.nbwf.modules.job.repository.JobApplicationWorkflowEventRepository;
import com.nbwf.modules.job.repository.JobApplicationWorkflowRepository;
import com.nbwf.modules.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class JobApplicationWorkflowService {

    private final JobRepository jobRepository;
    private final JobApplicationWorkflowRepository workflowRepository;
    private final JobApplicationWorkflowEventRepository eventRepository;

    @Transactional(readOnly = true)
    public JobApplicationWorkflowDTO getWorkflow(Long jobId, Long userId) {
        findJob(jobId, userId);
        return workflowRepository.findByJobIdAndUserId(jobId, userId)
            .map(this::toDTO)
            .orElse(null);
    }

    @Transactional
    public void recordJobImported(JobEntity job, boolean created) {
        JobApplicationWorkflowEntity workflow = getOrCreateWorkflow(job);
        recordEvent(
            workflow,
            JobApplicationWorkflowNode.JOB_IMPORTED,
            JobApplicationWorkflowEventType.NODE_COMPLETED,
            JobApplicationWorkflowStatus.WAITING_HUMAN,
            created ? "岗位已导入" : "岗位已更新",
            created ? "浏览器插件已采集岗位并导入职位工作台。" : "已根据最新采集内容更新职位工作台。",
            null,
            buildJobSnapshot(job),
            null,
            true,
            "准备开场白并由用户确认发送"
        );
    }

    @Transactional
    public JobApplicationWorkflowEventDTO createManualEvent(Long jobId,
                                                           Long userId,
                                                           CreateWorkflowEventRequest req) {
        JobEntity job = findJob(jobId, userId);
        JobApplicationWorkflowEntity workflow = getOrCreateWorkflow(job);
        JobApplicationWorkflowEventDTO dto = toDTO(recordEvent(
            workflow,
            req.nodeKey(),
            resolveEventType(req.nodeKey()),
            resolveStatus(req.nodeKey(), req.requiresHumanAction()),
            resolveTitle(req.nodeKey(), req.title()),
            req.content(),
            req.inputSnapshot(),
            req.outputSnapshot(),
            null,
            Boolean.TRUE.equals(req.requiresHumanAction()),
            resolveNextAction(req.nodeKey())
        ));
        return dto;
    }

    @Transactional
    public void recordApplicationSent(JobEntity job) {
        JobApplicationWorkflowEntity workflow = getOrCreateWorkflow(job);
        recordEvent(
            workflow,
            JobApplicationWorkflowNode.APPLICATION_SENT,
            JobApplicationWorkflowEventType.NODE_COMPLETED,
            JobApplicationWorkflowStatus.WAITING_HUMAN,
            "用户已确认投递",
            "用户确认已在外部招聘平台发送开场白或完成投递动作。",
            null,
            null,
            null,
            true,
            "等待 HR 回复，必要时设置下一次跟进"
        );
    }

    @Transactional
    public void recordFollowUpScheduled(JobEntity job, LocalDateTime nextFollowUpAt) {
        if (nextFollowUpAt == null) {
            return;
        }
        JobApplicationWorkflowEntity workflow = getOrCreateWorkflow(job);
        recordEvent(
            workflow,
            JobApplicationWorkflowNode.FOLLOW_UP_SCHEDULED,
            JobApplicationWorkflowEventType.WAITING_HUMAN,
            JobApplicationWorkflowStatus.WAITING_HUMAN,
            "已设置后续跟进",
            "系统已记录下一次跟进时间：" + nextFollowUpAt,
            null,
            null,
            null,
            true,
            "按计划跟进 HR 反馈"
        );
    }

    @Transactional
    public void deleteByJob(Long jobId, Long userId) {
        eventRepository.deleteByJobIdAndUserId(jobId, userId);
        workflowRepository.deleteByJobIdAndUserId(jobId, userId);
    }

    private JobApplicationWorkflowEntity getOrCreateWorkflow(JobEntity job) {
        return workflowRepository.findByJobIdAndUserId(job.getId(), job.getUserId())
            .orElseGet(() -> {
                JobApplicationWorkflowEntity workflow = new JobApplicationWorkflowEntity();
                workflow.setUserId(job.getUserId());
                workflow.setJobId(job.getId());
                workflow.setStatus(JobApplicationWorkflowStatus.RUNNING);
                workflow.setCurrentNode(JobApplicationWorkflowNode.JOB_IMPORTED);
                workflow.setNextAction("准备开场白并由用户确认发送");
                return workflowRepository.save(workflow);
            });
    }

    private JobApplicationWorkflowEventEntity recordEvent(JobApplicationWorkflowEntity workflow,
                                                         JobApplicationWorkflowNode node,
                                                         JobApplicationWorkflowEventType eventType,
                                                         JobApplicationWorkflowStatus status,
                                                         String title,
                                                         String content,
                                                         String inputSnapshot,
                                                         String outputSnapshot,
                                                         String errorMessage,
                                                         boolean requiresHumanAction,
                                                         String nextAction) {
        workflow.setCurrentNode(node);
        workflow.setStatus(status);
        workflow.setNextAction(nextAction);
        if (status == JobApplicationWorkflowStatus.COMPLETED || status == JobApplicationWorkflowStatus.CLOSED) {
            workflow.setCompletedAt(LocalDateTime.now());
        }
        JobApplicationWorkflowEntity savedWorkflow = workflowRepository.save(workflow);

        JobApplicationWorkflowEventEntity event = new JobApplicationWorkflowEventEntity();
        event.setWorkflowId(savedWorkflow.getId());
        event.setJobId(savedWorkflow.getJobId());
        event.setUserId(savedWorkflow.getUserId());
        event.setNodeKey(node);
        event.setEventType(eventType);
        event.setStatus(status);
        event.setTitle(title);
        event.setContent(content);
        event.setInputSnapshot(inputSnapshot);
        event.setOutputSnapshot(outputSnapshot);
        event.setErrorMessage(errorMessage);
        event.setRequiresHumanAction(requiresHumanAction);
        return eventRepository.save(event);
    }

    private JobApplicationWorkflowEventType resolveEventType(JobApplicationWorkflowNode node) {
        return switch (node) {
            case OPENER_COPIED, APPLICATION_SENT, JOB_IMPORTED, OPENER_GENERATED -> JobApplicationWorkflowEventType.NODE_COMPLETED;
            case FOLLOW_UP_SCHEDULED -> JobApplicationWorkflowEventType.WAITING_HUMAN;
            case WORKFLOW_CLOSED -> JobApplicationWorkflowEventType.WORKFLOW_CLOSED;
        };
    }

    private JobApplicationWorkflowStatus resolveStatus(JobApplicationWorkflowNode node, Boolean requiresHumanAction) {
        if (node == JobApplicationWorkflowNode.WORKFLOW_CLOSED) {
            return JobApplicationWorkflowStatus.CLOSED;
        }
        return Boolean.TRUE.equals(requiresHumanAction)
            ? JobApplicationWorkflowStatus.WAITING_HUMAN
            : JobApplicationWorkflowStatus.RUNNING;
    }

    private String resolveTitle(JobApplicationWorkflowNode node, String title) {
        String trimmed = trimToNull(title);
        if (trimmed != null) {
            return trimmed;
        }
        return switch (node) {
            case JOB_IMPORTED -> "岗位已导入";
            case OPENER_GENERATED -> "开场白已生成";
            case OPENER_COPIED -> "开场白已复制";
            case APPLICATION_SENT -> "用户已确认投递";
            case FOLLOW_UP_SCHEDULED -> "已设置后续跟进";
            case WORKFLOW_CLOSED -> "投递工作流已关闭";
        };
    }

    private String resolveNextAction(JobApplicationWorkflowNode node) {
        return switch (node) {
            case JOB_IMPORTED, OPENER_GENERATED -> "确认开场白内容并复制发送";
            case OPENER_COPIED -> "回到原岗位页发送给 HR，发送后标记已投递";
            case APPLICATION_SENT -> "等待 HR 回复，必要时设置下一次跟进";
            case FOLLOW_UP_SCHEDULED -> "按计划跟进 HR 反馈";
            case WORKFLOW_CLOSED -> "投递流程已结束";
        };
    }

    private JobEntity findJob(Long jobId, Long userId) {
        return jobRepository.findByIdAndUserId(jobId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.JOB_NOT_FOUND));
    }

    private String buildJobSnapshot(JobEntity job) {
        return "{\"jobId\":" + job.getId()
            + ",\"title\":\"" + escapeJson(job.getTitle())
            + "\",\"company\":\"" + escapeJson(job.getCompany())
            + "\",\"sourcePlatform\":\"" + escapeJson(job.getSourcePlatform())
            + "\"}";
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private JobApplicationWorkflowDTO toDTO(JobApplicationWorkflowEntity workflow) {
        List<JobApplicationWorkflowEventDTO> events = eventRepository.findByWorkflowIdOrderByCreatedAtDesc(workflow.getId())
            .stream()
            .map(this::toDTO)
            .toList();
        return new JobApplicationWorkflowDTO(
            workflow.getId(),
            workflow.getJobId(),
            workflow.getStatus(),
            workflow.getCurrentNode(),
            workflow.getNextAction(),
            workflow.getCreatedAt(),
            workflow.getUpdatedAt(),
            workflow.getCompletedAt(),
            events
        );
    }

    private JobApplicationWorkflowEventDTO toDTO(JobApplicationWorkflowEventEntity event) {
        return new JobApplicationWorkflowEventDTO(
            event.getId(),
            event.getWorkflowId(),
            event.getJobId(),
            event.getNodeKey(),
            event.getEventType(),
            event.getStatus(),
            event.getTitle(),
            event.getContent(),
            event.getInputSnapshot(),
            event.getOutputSnapshot(),
            event.getErrorMessage(),
            event.isRequiresHumanAction(),
            event.getCreatedAt()
        );
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
