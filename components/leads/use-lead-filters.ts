"use client"

import { useMemo, useState } from "react"
import type { Lead } from "./types"

export function useLeadFilters(leads: Lead[]) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [profileFilter, setProfileFilter] = useState("all")
  const [bdFilter, setBdFilter] = useState("all")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter(lead => {
      const matchQuery =
        !q ||
        lead.jobTitle.toLowerCase().includes(q) ||
        lead.company.toLowerCase().includes(q) ||
        lead.profileName.toLowerCase().includes(q)
      const matchStatus = statusFilter === "all" || lead.status === statusFilter
      const matchProfile = profileFilter === "all" || lead.profileId === profileFilter
      const matchBd = bdFilter === "all" || lead.assignedTo === bdFilter
      return matchQuery && matchStatus && matchProfile && matchBd
    })
  }, [leads, search, statusFilter, profileFilter, bdFilter])

  return {
    filtered,
    filterProps: {
      search,
      setSearch,
      statusFilter,
      setStatusFilter,
      profileFilter,
      setProfileFilter,
      bdFilter,
      setBdFilter,
    },
  }
}

export type LeadFilterProps = ReturnType<typeof useLeadFilters>["filterProps"]
