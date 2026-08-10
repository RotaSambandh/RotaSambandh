import { NextResponse } from "next/server";
import {
  getAllClubNames,
  getClubsForDistrict,
  getDistrictForClub,
  getRotaractDistricts,
} from "@/lib/data/rotaract-clubs";

export const dynamic = "force-static";

export async function GET() {
  const districts = getRotaractDistricts();
  const clubs = getAllClubNames();
  const clubsByDistrict: Record<string, string[]> = {};
  for (const district of districts) {
    clubsByDistrict[district] = getClubsForDistrict(district);
  }
  const districtByClub: Record<string, string> = {};
  for (const club of clubs) {
    const district = getDistrictForClub(club);
    if (district) districtByClub[club] = district;
  }

  return NextResponse.json({
    districts,
    clubs,
    clubsByDistrict,
    districtByClub,
  });
}
