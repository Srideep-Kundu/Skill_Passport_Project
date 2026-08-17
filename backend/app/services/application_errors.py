class ApplicationWorkflowError(Exception):
    def __init__(self, detail: str, status_code: int = 409) -> None:
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)
