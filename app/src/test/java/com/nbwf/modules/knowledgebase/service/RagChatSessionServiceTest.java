package com.nbwf.modules.knowledgebase.service;

import com.nbwf.infrastructure.mapper.KnowledgeBaseMapper;
import com.nbwf.infrastructure.mapper.RagChatMapper;
import com.nbwf.modules.knowledgebase.model.KnowledgeBaseEntity;
import com.nbwf.modules.knowledgebase.model.RagChatDTO;
import com.nbwf.modules.knowledgebase.model.RagChatSessionEntity;
import com.nbwf.modules.knowledgebase.repository.KnowledgeBaseRepository;
import com.nbwf.modules.knowledgebase.repository.RagChatMessageRepository;
import com.nbwf.modules.knowledgebase.repository.RagChatSessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RagChatSessionServiceTest {

    @Mock
    private RagChatSessionRepository sessionRepository;

    @Mock
    private RagChatMessageRepository messageRepository;

    @Mock
    private KnowledgeBaseRepository knowledgeBaseRepository;

    @Mock
    private KnowledgeBaseQueryService queryService;

    @Mock
    private RagChatMapper ragChatMapper;

    @Mock
    private KnowledgeBaseMapper knowledgeBaseMapper;

    @InjectMocks
    private RagChatSessionService ragChatSessionService;

    @Test
    void createSessionShouldUseCurrentUsersKnowledgeBasesAndBindUserId() {
        KnowledgeBaseEntity kb = new KnowledgeBaseEntity();
        kb.setId(11L);
        kb.setUserId(7L);
        kb.setName("Java 指南");

        when(knowledgeBaseRepository.findAllByIdInAndUserId(List.of(11L), 7L)).thenReturn(List.of(kb));
        when(sessionRepository.save(any(RagChatSessionEntity.class))).thenAnswer(invocation -> {
            RagChatSessionEntity entity = invocation.getArgument(0);
            entity.setId(99L);
            return entity;
        });
        when(ragChatMapper.toSessionDTO(any(RagChatSessionEntity.class))).thenReturn(
            new RagChatDTO.SessionDTO(99L, "Java 指南", List.of(11L), null)
        );

        ragChatSessionService.createSession(
            new RagChatDTO.CreateSessionRequest(List.of(11L), "Java 指南"),
            7L
        );

        ArgumentCaptor<RagChatSessionEntity> captor = ArgumentCaptor.forClass(RagChatSessionEntity.class);
        verify(sessionRepository).save(captor.capture());
        verify(knowledgeBaseRepository).findAllByIdInAndUserId(List.of(11L), 7L);
        assertEquals(7L, captor.getValue().getUserId());
    }
}
