package com.nbwf.modules.knowledgebase.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.infrastructure.file.FileStorageService;
import com.nbwf.infrastructure.mapper.KnowledgeBaseMapper;
import com.nbwf.modules.knowledgebase.model.KnowledgeBaseEntity;
import com.nbwf.modules.knowledgebase.model.KnowledgeBaseListItemDTO;
import com.nbwf.modules.knowledgebase.model.KnowledgeBaseStatsDTO;
import com.nbwf.modules.knowledgebase.model.RagChatMessageEntity.MessageType;
import com.nbwf.modules.knowledgebase.model.VectorStatus;
import com.nbwf.modules.knowledgebase.repository.KnowledgeBaseRepository;
import com.nbwf.modules.knowledgebase.repository.RagChatMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * 知识库查询服务
 * 负责知识库列表和详情的查询
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeBaseListService {

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final RagChatMessageRepository ragChatMessageRepository;
    private final KnowledgeBaseMapper knowledgeBaseMapper;
    private final FileStorageService fileStorageService;

    /**
     * 获取知识库列表（支持状态过滤和排序）
     * 
     * @param vectorStatus 向量化状态，null 表示不过滤
     * @param sortBy 排序字段，null 或 "time" 表示按时间排序
     * @return 知识库列表
     */
    public List<KnowledgeBaseListItemDTO> listKnowledgeBases(Long userId, VectorStatus vectorStatus, String sortBy) {
        List<KnowledgeBaseEntity> entities;
        
        // 如果指定了状态，按状态过滤
        if (vectorStatus != null) {
            entities = knowledgeBaseRepository.findByUserIdAndVectorStatusOrderByUploadedAtDesc(userId, vectorStatus);
        } else {
            entities = knowledgeBaseRepository.findByUserIdOrderByUploadedAtDesc(userId);
        }
        
        // 如果指定了排序字段，在内存中排序
        if (sortBy != null && !sortBy.isBlank() && !sortBy.equalsIgnoreCase("time")) {
            entities = sortEntities(entities, sortBy);
        }
        
        return knowledgeBaseMapper.toListItemDTOList(entities);
    }

    /**
     * 获取所有知识库列表（保持向后兼容）
     */
    public Optional<KnowledgeBaseListItemDTO> getKnowledgeBase(Long id, Long userId) {
        return knowledgeBaseRepository.findByIdAndUserId(id, userId)
            .map(knowledgeBaseMapper::toListItemDTO);
    }

    /**
     * 根据ID获取知识库实体（用于删除等操作）
     */
    public Optional<KnowledgeBaseEntity> getKnowledgeBaseEntity(Long id, Long userId) {
        return knowledgeBaseRepository.findByIdAndUserId(id, userId);
    }

    /**
     * 根据ID列表获取知识库名称列表
     */
    public List<String> getKnowledgeBaseNames(List<Long> ids, Long userId) {
        return ids.stream()
            .map(id -> knowledgeBaseRepository.findByIdAndUserId(id, userId)
                .map(KnowledgeBaseEntity::getName)
                .orElse("未知知识库"))
            .toList();
    }

    // ========== 分类管理 ==========

    /**
     * 获取所有分类
     */
    public List<String> getAllCategories(Long userId) {
        return knowledgeBaseRepository.findAllCategoriesByUserId(userId);
    }

    /**
     * 根据分类获取知识库列表
     */
    public List<KnowledgeBaseListItemDTO> listByCategory(Long userId, String category) {
        List<KnowledgeBaseEntity> entities;
        if (category == null || category.isBlank()) {
            entities = knowledgeBaseRepository.findByUserIdAndCategoryIsNullOrderByUploadedAtDesc(userId);
        } else {
            entities = knowledgeBaseRepository.findByUserIdAndCategoryOrderByUploadedAtDesc(userId, category);
        }
        return knowledgeBaseMapper.toListItemDTOList(entities);
    }

    /**
     * 更新知识库分类
     */
    @Transactional
    public void updateCategory(Long id, String category, Long userId) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.KNOWLEDGE_BASE_NOT_FOUND, "知识库不存在"));
        entity.setCategory(category != null && !category.isBlank() ? category : null);
        knowledgeBaseRepository.save(entity);
        log.info("更新知识库分类: id={}, category={}", id, category);
    }

    // ========== 搜索功能 ==========

    /**
     * 按关键词搜索知识库
     */
    public List<KnowledgeBaseListItemDTO> search(String keyword, Long userId) {
        if (keyword == null || keyword.isBlank()) {
            return listKnowledgeBases(userId, null, null);
        }
        return knowledgeBaseMapper.toListItemDTOList(
            knowledgeBaseRepository.searchByUserIdAndKeyword(userId, keyword.trim())
        );
    }

    /**
     * 在内存中对实体列表排序
     */
    private List<KnowledgeBaseEntity> sortEntities(List<KnowledgeBaseEntity> entities, String sortBy) {
        return switch (sortBy.toLowerCase()) {
            case "size" -> entities.stream()
                .sorted((a, b) -> Long.compare(b.getFileSize(), a.getFileSize()))
                .toList();
            case "access" -> entities.stream()
                .sorted((a, b) -> Integer.compare(b.getAccessCount(), a.getAccessCount()))
                .toList();
            case "question" -> entities.stream()
                .sorted((a, b) -> Integer.compare(b.getQuestionCount(), a.getQuestionCount()))
                .toList();
            default -> entities; // time 已经在数据库层面排序了
        };
    }

    // ========== 统计功能 ==========

    /**
     * 获取知识库统计信息
     * 总提问次数从用户消息数统计，确保多知识库提问只算一次
     */
    public KnowledgeBaseStatsDTO getStatistics(Long userId) {
        return new KnowledgeBaseStatsDTO(
            knowledgeBaseRepository.countByUserId(userId),
            ragChatMessageRepository.countByTypeAndSession_UserId(MessageType.USER, userId),
            knowledgeBaseRepository.sumAccessCountByUserId(userId),
            knowledgeBaseRepository.countByUserIdAndVectorStatus(userId, VectorStatus.COMPLETED),
            knowledgeBaseRepository.countByUserIdAndVectorStatus(userId, VectorStatus.PROCESSING)
        );
    }

    // ========== 下载功能 ==========

    /**
     * 下载知识库文件
     */
    public byte[] downloadFile(Long id, Long userId) {
        KnowledgeBaseEntity entity = knowledgeBaseRepository.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.KNOWLEDGE_BASE_NOT_FOUND, "知识库不存在"));

        String storageKey = entity.getStorageKey();
        if (storageKey == null || storageKey.isBlank()) {
            throw new BusinessException(ErrorCode.STORAGE_DOWNLOAD_FAILED, "文件存储信息不存在");
        }

        log.info("下载知识库文件: id={}, filename={}", id, entity.getOriginalFilename());
        return fileStorageService.downloadFile(storageKey);
    }

    /**
     * 获取知识库文件信息（用于下载）
     */
    public KnowledgeBaseEntity getEntityForDownload(Long id, Long userId) {
        return knowledgeBaseRepository.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.KNOWLEDGE_BASE_NOT_FOUND, "知识库不存在"));
    }
}
