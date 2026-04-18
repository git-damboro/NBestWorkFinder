package com.nbwf.modules.knowledgebase.service;

import com.nbwf.modules.knowledgebase.model.KnowledgeBaseEntity;
import com.nbwf.modules.knowledgebase.repository.KnowledgeBaseRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBasePersistenceServiceTest {

    @Mock
    private KnowledgeBaseRepository knowledgeBaseRepository;

    @InjectMocks
    private KnowledgeBasePersistenceService knowledgeBasePersistenceService;

    @Test
    void saveKnowledgeBaseShouldBindCurrentUser() {
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "java-guide.pdf",
            "application/pdf",
            "content".getBytes(StandardCharsets.UTF_8)
        );

        when(knowledgeBaseRepository.save(any(KnowledgeBaseEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        knowledgeBasePersistenceService.saveKnowledgeBase(
            file,
            "Java 指南",
            "Java",
            "storage-key",
            "storage-url",
            "hash-1",
            7L
        );

        ArgumentCaptor<KnowledgeBaseEntity> captor = ArgumentCaptor.forClass(KnowledgeBaseEntity.class);
        verify(knowledgeBaseRepository).save(captor.capture());
        assertEquals(7L, captor.getValue().getUserId());
        assertEquals("hash-1", captor.getValue().getFileHash());
    }
}
