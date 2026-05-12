import enum


class Direction(str, enum.Enum):
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"


class AnalysisStatus(str, enum.Enum):
    PENDING = "PENDING"
    READY_TO_REVIEW = "READY_TO_REVIEW"
    REVIEWED = "REVIEWED"
    TRACKING = "TRACKING"
    DATA_ERROR = "DATA_ERROR"


class DataStatus(str, enum.Enum):
    UNKNOWN = "UNKNOWN"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"
