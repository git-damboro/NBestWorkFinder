package com.nbwf.modules.interview.service;

import com.nbwf.infrastructure.export.PdfExportService;
import com.nbwf.infrastructure.mapper.InterviewMapper;
import com.nbwf.modules.interview.model.InterviewSessionEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterviewHistoryServiceTest {

    @Mock
    private InterviewPersistenceService interviewPersistenceService;

    @Mock
    private PdfExportService pdfExportService;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private InterviewMapper interviewMapper;

    @InjectMocks
    private InterviewHistoryService interviewHistoryService;

    @Test
    void getInterviewDetailShouldLookupSessionWithinCurrentUserScope() {
        when(interviewPersistenceService.findBySessionId("session-1", 7L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> interviewHistoryService.getInterviewDetail("session-1", 7L));

        verify(interviewPersistenceService).findBySessionId("session-1", 7L);
    }
}
